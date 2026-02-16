
export enum Category {
  MODEL = 'Model',
  MODULE = 'Module',
  SCRIPT = 'Script',
  MAP = 'Map',
  MODEL_3D = '3D Model',
  UI = 'UI',
  PLUGIN = 'Plugin'
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  provider: 'google' | 'discord';
  followers: string[];
  following: string[];
  bio?: string;
  links?: { label: string, url: string }[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
}

export interface VerificationData {
  status: string;
  checkedAt: number;
  apiProvider: string;
  verified: boolean;
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  title: string;
  description: string;
  category: Category;
  thumbnailUrl: string;
  videoUrl?: string;
  fileType: '.rbxm' | '.rbxl' | '.rbxmx';
  fileData?: string; 
  creditsRequired: boolean;
  likes: string[];
  dislikes: string[];
  reports: string[];
  comments: Comment[];
  downloadCount: number;
  timestamp: number;
  verification?: VerificationData;
}
