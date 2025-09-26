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
    userId: string;
    name: string;
    initialRequirements: string;
    files: GeneratedFile[];
    createdAt: Date;
    updatedAt: Date;
}
