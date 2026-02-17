
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedAt: number;
  isVerified: boolean;
  isBanned?: boolean; // Novo campo para moderação
  followers: string[]; // IDs de quem segue este usuário
  following: string[]; // IDs de quem este usuário segue
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  authorVerified?: boolean; // Cache da verificação no momento do upload
  title: string;
  originalFileName: string;
  description: string;
  category: Category;
  thumbnailUrl: string;
  fileUrl: string;
  videoUrl?: string;
  fileType: RobloxFileType;
  downloadCount: number;
  likes: string[];
  reports: number;
  credits: string;
  comments: Comment[];
  timestamp: number;
  keywords: string[];
}
