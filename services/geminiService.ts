import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedFile } from '../types';

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

const parseJsonResponse = (jsonString: string): GeneratedFile[] => {
    const generatedFiles = JSON.parse(jsonString);
    if (!Array.isArray(generatedFiles) || generatedFiles.some(f => typeof f.path !== 'string' || typeof f.content !== 'string')) {
        throw new Error("API returned an invalid data structure.");
    }
    return generatedFiles as GeneratedFile[];
};

const streamAndParseResponse = async (
    prompt: string,
    onProgress: (progress: string) => void
): Promise<GeneratedFile[]> => {
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
                onProgress(fullJsonResponse);
            }
        }

        return parseJsonResponse(fullJsonResponse);
    } catch (error) {
        console.error("Error generating code with Gemini:", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse the model's response. The generated JSON was malformed.");
        }
        throw new Error("Failed to generate code. The model may have returned an unexpected format. Please check the console for details.");
    }
}


export async function generateCode(
  requirements: string,
  onProgress: (progress: string) => void
): Promise<GeneratedFile[]> {
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

  return streamAndParseResponse(prompt, onProgress);
}


export async function refineCode(
    changeRequest: string,
    currentCode: GeneratedFile[],
    onProgress: (progress: string) => void
): Promise<GeneratedFile[]> {
    const currentCodeJson = JSON.stringify(currentCode, null, 2);

    // FIX: Removed unnecessary backslashes from the template literal. The backslashes were causing a syntax error by escaping the backticks and template variable placeholders.
    const prompt = `
    You are an expert C# .NET architect specializing in Clean Architecture.
    A C# codebase has already been generated, and is provided as a JSON array. The user now wants to make changes to it.

    Your task is to take the user's change request and the CURRENT codebase (in JSON format) and return a NEW, complete JSON array representing the MODIFIED codebase.

    - Analyze the user's request.
    - Apply the requested changes to the relevant files in the provided JSON. This might involve modifying existing file content, adding new files, or even deleting files if requested.
    - Return the FULL, updated codebase structure as a single, valid JSON array object.

    The output format MUST be identical to the input format: an array of objects, where each object has "path" and "content" keys.
    Do NOT just return the changed files. Return the entire project structure with the changes applied.
    Do NOT omit any files from the original JSON unless the user specifically asked for their deletion.

    IMPORTANT FORMATTING RULES for the "content" field:
    - The code within the "content" string MUST be properly formatted with correct indentation and newlines (\\n).
    - Ensure all files necessary for the project are present in the final JSON.
    - Do NOT return the code as a single-line string. It must contain escaped newlines for JSON compatibility.
    - Do NOT include any markdown formatting like \`\`\`csharp in the code content itself. The content should be pure source code.

    ---
    USER'S CHANGE REQUEST:
    ${changeRequest}
    ---
    CURRENT CODEBASE (JSON):
    ${currentCodeJson}
    ---
  `;

    return streamAndParseResponse(prompt, onProgress);
}
