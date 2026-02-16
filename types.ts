
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
  followers: string[]; // User IDs
  following: string[]; // User IDs
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
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
  creditsRequired: boolean;
  likes: string[]; // User IDs
  dislikes: string[]; // User IDs
  comments: Comment[];
  downloadCount: number;
  timestamp: number;
}

export interface AppState {
  currentUser: User | null;
  assets: Asset[];
  searchQuery: string;
  selectedCategory: Category | 'All';
  sortBy: 'latest' | 'likes';
}
