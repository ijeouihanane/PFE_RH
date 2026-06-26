export interface AiChatResponse {
  answer: string;
  docSource?: string;
  pageNumber?: number;
  pageRange?: string;
  confidenceScore: number;
  answered: boolean;
  modelUsed: string;
}

export interface ChatLogEntry {
  id: number;
  userId: number;
  question: string;
  answer: string;
  docSource?: string;
  pageNumber?: number;
  pageRange?: string;
  confidenceScore: number;
  answered: boolean;
  modelUsed?: string;
  createdAt: string;
}

export interface AiStatus {
  available: boolean;
  documentsIndexed: number;
  documentsInDb: number;
}

export interface AiDocItem {
  id: number;
  titre: string;
  originalFileName: string;
  fichierUrl?: string;
  nbPages?: number;
  nbChunks?: number;
  summary?: string;
  keywords?: string;
  indexedInAI?: boolean;
  uploadedBy: number;
  createdAt: string;
}
