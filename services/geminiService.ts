import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GeneratedFile, FilePatch, ChatMessage } from '../types';
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
    try {
        const generatedFiles = JSON.parse(jsonString);
        if (!Array.isArray(generatedFiles) || generatedFiles.some(f => typeof f.path !== 'string' || typeof f.content !== 'string')) {
            throw new Error("API returned an invalid data structure.");
        }
        return generatedFiles as GeneratedFile[];
    } catch (e) {
        console.error("Malformed JSON received:", jsonString);
        throw new Error("Failed to parse the model's response. The generated JSON was malformed.");
    }
};

const parsePatchJsonResponse = (jsonString: string): FilePatch[] => {
    const patch = JSON.parse(jsonString);
    if (!Array.isArray(patch)) {
        throw new Error("API returned an invalid data structure for patch.");
    }
    return patch as FilePatch[];
};

/**
 * Helper function to make Gemini API requests with retry logic and exponential backoff.
 * Handles RESOURCE_EXHAUSTED (429) errors.
 * Immediately throws a user-friendly error for INVALID_ARGUMENT (400) token limit errors.
 * @param requestFn The function that makes the actual Gemini API call (e.g., generateContentStream).
 * @param onProgressUpdate A callback to update the UI/logs with progress messages, especially during retries.
 * @param maxRetries The maximum number of retry attempts.
 * @returns The full accumulated text response from the Gemini model.
 * @throws An error if all retries are exhausted or a non-retryable error occurs.
 */
async function makeGeminiRequestWithRetry(
    requestFn: () => Promise<AsyncIterable<GenerateContentResponse>>,
    onProgressUpdate: (log: string) => Promise<void> | void,
    maxRetries = 3
): Promise<string> {
    let attempt = 0;
    let delay = 1000; // Initial delay for exponential backoff (1 second)
    let fullResponseText = '';

    while (attempt < maxRetries) {
        attempt++;
        try {
            await onProgressUpdate(`Attempt ${attempt}/${maxRetries}: Contacting AI...`);

            const responseStream = await requestFn();
            fullResponseText = ''; // Reset for each streaming attempt

            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullResponseText += chunkText;
                    await onProgressUpdate(fullResponseText); // Update with cumulative progress
                }
            }
            return fullResponseText; // Success
        } catch (e: any) {
            console.error(`Gemini API Error (Attempt ${attempt}):`, e);

            let parsedError: any = null;
            try {
                // The error.message from the API client is often a stringified JSON object
                // that might also be wrapped in a simple error string.
                // Attempt to extract and parse the inner JSON error details.
                const jsonMatch = String(e.message).match(/\{[\s\S]*\}/); // Find the first JSON object
                if (jsonMatch) {
                    parsedError = JSON.parse(jsonMatch[0]);
                }
            } catch (parseError) {
                console.warn("Failed to parse detailed API error message as JSON:", parseError);
            }

            const errorCode = e.code || parsedError?.error?.code;
            const errorMessage = e.message || parsedError?.error?.message;
            const errorStatus = parsedError?.error?.status;
            
            // Handle INVALID_ARGUMENT (400) specifically for token limit errors
            if (errorCode === 400 && errorMessage && errorMessage.includes("input token count exceeds the maximum")) {
                throw new Error(`Your input (requirements + existing code) is too large for the AI model to process. Please simplify your requirements or reduce the number/size of base files you're providing. (Error: ${errorMessage.split('\n')[0]})`);
            }

            // Handle RESOURCE_EXHAUSTED (429) errors with retry logic
            if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
                let retryAfterSeconds = delay / 1000; // Default to current exponential delay
                let detailedErrorMessage = "Quota exceeded. Please wait or check your billing.";
                let quotaInfoLink = "https://ai.google.dev/gemini-api/docs/rate-limits";

                if (parsedError?.error) {
                    const errorObj = parsedError.error;
                    // Take the first line of the error message, as it can be multi-line
                    detailedErrorMessage = errorObj.message.split('\n')[0];
                    const details = errorObj.details;

                    const retryInfo = details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                    if (retryInfo?.retryDelay) {
                        const match = retryInfo.retryDelay.match(/(\d+)s/);
                        if (match && match[1]) {
                            retryAfterSeconds = parseInt(match[1]);
                        }
                    }

                    const helpLink = details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.Help');
                    if (helpLink?.links?.[0]?.url) {
                        quotaInfoLink = helpLink.links[0].url;
                    }
                }

                if (attempt < maxRetries) {
                    const waitTime = retryAfterSeconds * 1000;
                    const progressMsg = `Quota exceeded. Retrying in ${Math.ceil(waitTime / 1000)}s... (Attempt ${attempt}/${maxRetries})\nReason: ${detailedErrorMessage}\nMore info: ${quotaInfoLink}`;
                    await onProgressUpdate(progressMsg);
                    await new Promise(res => setTimeout(res, waitTime));
                    delay *= 2; // Exponential backoff for subsequent retries if retryDelay isn't provided or parsed.
                } else {
                    // All retries exhausted
                    throw new Error(`Failed after ${maxRetries} attempts due to quota exhaustion. ${detailedErrorMessage}. For more information, visit ${quotaInfoLink}`);
                }
            } else {
                // For any other non-429 and non-400 token limit error, rethrow immediately
                throw e;
            }
        }
    }
    // This line should ideally not be reached if maxRetries > 0 and the loop handles it.
    throw new Error(`Unknown error after ${maxRetries} attempts.`);
}


export async function generateCode(
  packageId: string,
  requirements: string,
  baseFiles: GeneratedFile[] | null
): Promise<void> {
  let prompt: string;

  if (baseFiles && baseFiles.length > 0) {
    prompt = `
    You are an expert C# .NET architect specializing in Clean Architecture.
    Your task is to generate a complete C# codebase based on a user's requirements.

    You have been provided with a set of existing files to use as a starting point. Your goal is to intelligently integrate these files with the user's requirements to produce a final, coherent codebase.

    Follow these steps:
    1.  Analyze the user's requirements thoroughly.
    2.  Review the provided existing files (their paths and content).
    3.  Compare the existing files against the requirements.
    4.  **Decision Making:**
        - If an existing file perfectly matches a requirement, **keep it as is** (do not include it in the output if no changes are needed).
        - If an existing file is close but needs modifications (e.g., adding a property, changing logic), **update its content accordingly**.
        - If an existing file is no longer needed or is incorrect according to the requirements, **discard it** (do not include it in your final output).
        - If a file is required but does not exist in the provided files, **generate it from scratch**.
    5.  Ensure the final result is a complete, runnable solution that meets all requirements.

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

    ---
    USER REQUIREMENTS:
    ${requirements}
    ---
    EXISTING FILES (JSON):
    ${JSON.stringify(baseFiles, null, 2)}
    ---
  `;
  } else {
    prompt = `
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
  }

  try {
    const fullJsonResponse = await makeGeminiRequestWithRetry(
      () => ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: JSON_RESPONSE_SCHEMA,
              // Low thinking budget to encourage faster streaming of initial files
              thinkingConfig: { thinkingBudget: 100 },
          },
      }),
      (progressLog: string) => firestoreService.updatePackageGenerationProgress(packageId, progressLog),
      3 // Max 3 retries for generation
    );
    
    const generatedFiles = parseJsonResponse(fullJsonResponse);
    await firestoreService.finalizePackageGeneration(packageId, generatedFiles);

  } catch (error) {
    console.error("Error generating code with Gemini:", error);
    let errorMessage = "Failed to generate code. The model may have returned an unexpected format.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    await firestoreService.failPackageGeneration(packageId, errorMessage);
  }
}


export async function refineCode(
    changeRequest: string,
    currentCode: GeneratedFile[],
    onProgress: (progress: string) => void,
    images?: { mimeType: string; data: string }[]
): Promise<FilePatch[]> {
    let currentCodeJson: string;
    try {
        // The `currentCode` object comes from the app's state. If it contains complex,
        // non-serializable objects from Firestore, JSON.stringify will fail.
        currentCodeJson = JSON.stringify(currentCode, null, 2);
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('circular structure')) {
            console.error("Circular structure detected in code files before sending to API:", currentCode);
            throw new Error("A circular reference was detected in the project data, which prevents communication with the AI. This is usually a temporary issue with how data is loaded. Please try reloading the project.");
        }
        throw error; // Re-throw other errors
    }

    const prompt = `
    You are an expert C# .NET architect specializing in Clean Architecture.
    A C# codebase is provided as a JSON array. The user wants to make changes to it.
    If the user provides images, use them as context for the change request.

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
    - When updating an existing file, you MUST incorporate the user's requested changes while preserving all previous, unaffected code. The provided codebase reflects all prior modifications. Your changes should be incremental. Do not regenerate files from scratch.
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

    const textPart = { text: prompt };
    const imageParts = images?.map(img => ({
        inlineData: {
            mimeType: img.mimeType,
            data: img.data,
        },
    })) || [];

    const contents = { parts: [textPart, ...imageParts] };

    try {
        const fullJsonResponse = await makeGeminiRequestWithRetry(
            () => ai.models.generateContentStream({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: PATCH_RESPONSE_SCHEMA,
                },
            }),
            onProgress, // Pass the existing onProgress directly
            3 // Max 3 retries for refinement
        );

        return parsePatchJsonResponse(fullJsonResponse);
    } catch (error) {
        console.error("Error refining code with Gemini:", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse the model's patch response. The generated JSON was malformed.");
        }
        // Rethrow the error message directly from makeGeminiRequestWithRetry
        throw error;
    }
}

export async function consolidateRequirements(
    initialRequirements: string,
    chatHistory: ChatMessage[]
): Promise<string> {
    const userMessages = chatHistory
        .filter(msg => msg.role === 'user')
        .map((msg, index) => `Request ${index + 1}:\n${msg.content}`)
        .join('\n\n---\n\n');

    const prompt = `
    You are an expert technical writer and software architect. Your task is to synthesize a project requirements document.

    You will be given an initial set of requirements in Markdown format and a series of user change requests from a chat conversation.

    Your goal is to produce a single, final, and coherent Markdown document that incorporates all the changes from the chat history into the initial requirements. The final document should be a complete set of instructions that, if given to an AI code generation model, would result in the project's current, evolved state.

    - **Integrate Changes:** Don't just append the changes. Logically merge them into the relevant sections of the original document. If a user asks to "add a property," find the entity definition and add it there. If they ask to "change the database," find the data access section and update it.
    - **Maintain Format:** Preserve the original Markdown formatting (headings, lists, code blocks).
    - **Be Comprehensive:** The final document must be a complete, standalone set of requirements.
    - **Output Only Markdown:** Your entire response MUST be ONLY the final Markdown document. Do not include any conversational text, introductions, or explanations like "Here is the consolidated document:".

    ---
    INITIAL REQUIREMENTS:
    ${initialRequirements}
    ---
    CHAT HISTORY (User Requests):
    ${userMessages}
    ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error consolidating requirements:", error);
        throw new Error("Failed to generate the consolidated requirements document.");
    }
}

export async function generateDetailedDocumentation(
    projectName: string,
    files: GeneratedFile[]
): Promise<string> {
    const prompt = `
    You are an expert senior software architect and technical writer. Your task is to generate a comprehensive and detailed requirements document in Markdown format for an existing C# codebase.

    You will be provided with the project name and a JSON object containing an array of all the files in the project, including their paths and content.

    Analyze the entire codebase to understand its structure, functionality, and the role of each file. Then, produce a single, well-structured Markdown document that serves as a detailed technical specification.

    The document should include:
    1.  **A main title** for the project.
    2.  **An overview section** that describes the project's overall architecture (e.g., Clean Architecture), purpose, and key technologies used.
    3.  **A "File Breakdown" section.** Under this, for EACH file provided, create a subsection with:
        - The full file path as a heading.
        - A clear and concise description of the file's purpose and its responsibilities within the application.
        - An explanation of key classes, methods, properties, or logic contained within the file.

    Adhere to the following rules:
    - Your entire output MUST be only the final Markdown document.
    - Do not include any conversational text, introductions, or explanations like "Here is the documentation:".
    - Use appropriate Markdown formatting (headings, lists, code blocks for snippets if necessary) to create a clean and readable document.

    ---
    PROJECT NAME:
    ${projectName}
    ---
    PROJECT FILES (JSON):
    ${JSON.stringify(files, null, 2)}
    ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating detailed documentation:", error);
        throw new Error("Failed to generate the detailed documentation.");
    }
}