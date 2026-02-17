
export enum Category {
  MODEL = 'Model',
  SCRIPT = 'Script',
  MAP = 'Map',
  UI = 'UI',
  PLUGIN = 'Plugin',
  ANIMATION = 'Animation'
}

export type RobloxFileType = '.rbxm' | '.rbxl' | '.rbxmx';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
}

export interface Asset {
  id: string; // Internal Unique ID
  userId: string;
  authorName: string;
  authorAvatar: string;
  title: string;
  originalFileName: string;
  description: string;
  category: Category;
  thumbnailUrl: string;
  fileUrl: string;
  videoUrl?: string; // Mandatório agora
  fileType: RobloxFileType;
  downloadCount: number;
  likes: string[]; // User IDs
  reports: number;
  credits: string; // Autor original/Créditos
  comments: Comment[];
  timestamp: number;
  keywords: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedAt: number;
}
