
export enum Category {
  MODEL = 'Model',
  SCRIPT = 'Script',
  MAP = 'Map',
  UI = 'UI',
  PLUGIN = 'Plugin',
  ANIMATION = 'Animation'
}

export type TabId = 'explore' | 'verified' | 'market' | 'profile' | 'admin';

export type RobloxFileType = '.rbxm' | '.rbxl' | '.rbxmx';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedAt: number;
  isVerified: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  followers: string[];
  following: string[];
}

export interface Asset {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  authorVerified: boolean;
  title: string;
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
  timestamp: number;
  keywords: string[];
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}
