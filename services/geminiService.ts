import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedFile, FilePatch } from '../types';
import * as firestoreService from './firestoreService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const JSON_RESPONSE_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            path: {
                type: Type.STRING,
                description: 'The full file path, including the project directory. e.g., "Pd.Starter.Domain/Entities/User.cs"',
            },
            content: {
                type: Type.STRING,
                description: 'The full, raw content of the file, with proper newlines and indentation.',
            },
        },
        required: ['path', 'content'],
    },
};

const PATCH_RESPONSE_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            op: {
                type: Type.STRING,
                description: 'The operation to perform: "add", "update", or "delete".'
            },
            path: {
                type: Type.STRING,
                description: 'The full file path for the operation. e.g., "Pd.Starter.Domain/Entities/User.cs"',
            },
            content: {
                type: Type.STRING,
                description: 'The full file content. Required for "add" and "update" operations.',
            },
        },
        required: ['op', 'path'],
    },
};


const parseJsonResponse = (jsonString: string): GeneratedFile[] => {
    const generatedFiles = JSON.parse(jsonString);
    if (!Array.isArray(generatedFiles) || generatedFiles.some(f => typeof f.path !== 'string' || typeof f.content !== 'string')) {
        throw new Error("API returned an invalid data structure.");
    }
    return generatedFiles as GeneratedFile[];
};

const parsePatchJsonResponse = (jsonString: string): FilePatch[] => {
    const patch = JSON.parse(jsonString);
    if (!Array.isArray(patch)) {
        throw new Error("API returned an invalid data structure for patch.");
    }
    return patch as FilePatch[];
};

export async function generateCode(
  packageId: string,
  requirements: string,
): Promise<void> {
  const prompt = `
    You are an expert C# .NET architect specializing in Clean Architecture.
    Generate a complete C# codebase for a .NET 10.0 solution based on the following requirements.
    
    The output MUST be a single, valid JSON object. This JSON object must be an array of objects.
    Each object in the array represents a file and must have two keys:
    1. "path": A string for the full file path (e.g., 'Pd.Starter.Domain/Entities/User.cs').
    2. "content": A string containing the full source code for that file.

    IMPORTANT FORMATTING RULES for the "content" field:
    - The code within the "content" string MUST be properly formatted with correct indentation and newlines (\\n).
    - It should be human-readable as if you were viewing it in a text editor.
    - Ensure all files necessary files are generated. Recheck that cs, sln, csproj, etc. are create as intended.
    - Do NOT return the code as a single-line string. It must contain escaped newlines for JSON compatibility.
    - Do NOT include any markdown formatting like \`\`\`csharp in the code content itself. The content should be pure source code.

    Adhere strictly to all specified project names, namespaces, dependencies, and architectural patterns mentioned in the requirements.
    Ensure the generated code is complete, valid, and follows C# best practices.

    Requirements:
    ---
    ${requirements}
    ---
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: JSON_RESPONSE_SCHEMA,
        },
    });

    let fullJsonResponse = '';
    for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        if (chunkText) {
            fullJsonResponse += chunkText;
            // Update firestore with progress
            await firestoreService.updatePackageGenerationProgress(packageId, fullJsonResponse);
        }
    }
    
    const generatedFiles = parseJsonResponse(fullJsonResponse);
    // Finalize generation in firestore
    await firestoreService.finalizePackageGeneration(packageId, generatedFiles);

  } catch (error) {
    console.error("Error generating code with Gemini:", error);
    let errorMessage = "Failed to generate code. The model may have returned an unexpected format.";
    if (error instanceof SyntaxError) {
        errorMessage = "Failed to parse the model's response. The generated JSON was malformed.";
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Mark generation as failed in firestore
    await firestoreService.failPackageGeneration(packageId, errorMessage);
  }
}


export async function refineCode(
    changeRequest: string,
    currentCode: GeneratedFile[],
    onProgress: (progress: string) => void
): Promise<FilePatch[]> {
    const currentCodeJson = JSON.stringify(currentCode, null, 2);

    const prompt = `
    You are an expert C# .NET architect specializing in Clean Architecture.
    A C# codebase is provided as a JSON array. The user wants to make changes to it.

    Your task is to analyze the user's change request and the current codebase, and return ONLY a JSON array of operations representing the necessary changes. This is a "patch".

    The patch array must contain objects, each with the following keys:
    1. "op": The operation to perform. Must be one of "add", "update", or "delete".
    2. "path": The full file path for the file to be changed.
    3. "content": The full new source code for the file. This key is REQUIRED for "add" and "update" operations, and should be OMITTED for "delete".

    Example of a valid patch response:
    [
      {
        "op": "update",
        "path": "Pd.Starter.Domain/Entities/User.cs",
        "content": "public class User\\n{\\n  // ... updated content ...\\n}"
      },
      {
        "op": "add",
        "path": "Pd.Starter.Domain/DTOs/UserDto.cs",
        "content": "public class UserDto\\n{\\n  // ... new file content ...\\n}"
      },
      {
        "op": "delete",
        "path": "Pd.Starter.Domain/Entities/OldEntity.cs"
      }
    ]

    IMPORTANT RULES:
    - Only return the patch. DO NOT return the full, modified codebase.
    - If a file is not changed, it should NOT appear in the patch.
    - For "add" and "update", the "content" field MUST contain the complete, new source code for that file, with proper formatting and escaped newlines (\\n).
    - Do NOT include markdown formatting like \`\`\`csharp. The content should be pure source code.

    ---
    USER'S CHANGE REQUEST:
    ${changeRequest}
    ---
    CURRENT CODEBASE (JSON):
    ${currentCodeJson}
    ---
  `;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: PATCH_RESPONSE_SCHEMA,
            },
        });

        let fullJsonResponse = '';
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullJsonResponse += chunkText;
                onProgress(fullJsonResponse);
            }
        }

        return parsePatchJsonResponse(fullJsonResponse);
    } catch (error) {
        console.error("Error refining code with Gemini:", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse the model's patch response. The generated JSON was malformed.");
        }
        throw new Error("Failed to generate patch. The model may have returned an unexpected format. Please check the console for details.");
    }
}
