
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
  isBanned?: boolean;
  isAdmin: boolean; // Campo persistido para privilégios administrativos
  followers: string[];
  following: string[];
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  authorVerified?: boolean;
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
