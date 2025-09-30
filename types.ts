export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
    timestamp?: Date;
}

export interface Package {
    id: string;
    userId?: string; // User ID is optional for guest packages
    name: string;
    initialRequirements: string;
    files: GeneratedFile[] | null; // Can be null during generation
    createdAt: Date;
    updatedAt: Date;
    status: 'generating' | 'completed' | 'failed';
    generationLog?: string; // To store progress stream
    error?: string; // To store error message if generation fails
}

export type FilePatch =
  | { op: 'add'; path: string; content: string }
  | { op: 'update'; path: string; content: string }
  | { op: 'delete'; path: string };

export interface Checkpoint {
    id: string;
    createdAt: Date;
    message: string;
    files: GeneratedFile[];
}