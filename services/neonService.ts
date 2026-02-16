
import { Asset, User, Category } from '../types';

/**
 * Excalibur Storage Service (Puter Cloud Engine)
 * Prevents 404s by checking file status before reading and populates 
 * initial "Seed Data" for a premium first-time experience.
 */

declare const puter: any;

const DB_PATH = 'Documents/ExcaliburStore/registry_v3.json';

interface DatabaseSchema {
  assets: Asset[];
  users: User[];
  comments: Record<string, any[]>;
}

// Premium Seed Data to make the site look populated on first load
const getSeedData = (): DatabaseSchema => ({
  assets: [
    {
      id: 'seed_1',
      userId: 'system',
      authorName: 'Excalibur_Dev',
      authorAvatar: 'https://ui-avatars.com/api/?name=Excalibur&background=000&color=fff',
      title: 'Advanced Vehicle Chassis v4',
      description: 'A professional-grade vehicle system with realistic suspension, custom engine sounds, and mobile support. Optimized for high-performance racing games.',
      category: Category.MODEL,
      thumbnailUrl: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800',
      fileType: '.rbxm',
      fileData: '#', // Placeholder for seed
      creditsRequired: false,
      likes: [],
      dislikes: [],
      reports: [],
      comments: [],
      downloadCount: 1240,
      timestamp: Date.now() - 86400000
    },
    {
      id: 'seed_2',
      userId: 'system',
      authorName: 'NeonArchitect',
      authorAvatar: 'https://ui-avatars.com/api/?name=Architect&background=3b82f6&color=fff',
      title: 'Cyberpunk District Module',
      description: 'A modular kit for building sci-fi environments. Includes neon signs, procedural pipes, and high-fidelity textures.',
      category: Category.MAP,
      thumbnailUrl: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&q=80&w=800',
      fileType: '.rbxl',
      fileData: '#',
      creditsRequired: true,
      likes: [],
      dislikes: [],
      reports: [],
      comments: [],
      downloadCount: 850,
      timestamp: Date.now() - 172800000
    }
  ],
  users: [
    {
      id: 'system',
      name: 'Excalibur Official',
      username: 'official@excalibur.store',
      avatar: 'https://ui-avatars.com/api/?name=Excalibur&background=000&color=fff',
      provider: 'google',
      followers: [],
      following: [],
      bio: 'The official archive account for premium Roblox assets.'
    }
  ],
  comments: {}
});

async function readDb(): Promise<DatabaseSchema> {
  try {
    // Check if file exists first to avoid browser 404 console errors
    const stats = await puter.fs.stat(DB_PATH).catch(() => null);
    
    if (!stats) {
      console.log("Registry not found. Initializing with Seed Data.");
      const seed = getSeedData();
      await writeDb(seed);
      return seed;
    }

    const data = await puter.fs.read(DB_PATH);
    const text = await data.text();
    const parsed = JSON.parse(text);
    
    // Safety check: Ensure assets is an array
    if (!Array.isArray(parsed.assets)) return getSeedData();
    
    return parsed;
  } catch (e) {
    console.warn("Storage warning - fallback to seed:", e);
    return getSeedData();
  }
}

async function writeDb(db: DatabaseSchema): Promise<void> {
  try {
    await puter.fs.mkdir('Documents/ExcaliburStore', { recursive: true }).catch(() => null);
    await puter.fs.write(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Critical Storage Error:", e);
  }
}

export const neonDb = {
  async getAllAssets(): Promise<Asset[]> {
    const db = await readDb();
    return db.assets;
  },

  async getAllUsers(): Promise<User[]> {
    const db = await readDb();
    return db.users;
  },

  async saveUser(user: User) {
    const db = await readDb();
    const index = db.users.findIndex(u => u.id === user.id);
    if (index > -1) {
      db.users[index] = { ...db.users[index], ...user };
    } else {
      db.users.push(user);
    }
    await writeDb(db);
  },

  async saveAsset(asset: Asset) {
    const db = await readDb();
    db.assets.unshift(asset); 
    await writeDb(db);
  },

  async saveComment(comment: any, assetId: string) {
    const db = await readDb();
    if (!db.comments[assetId]) db.comments[assetId] = [];
    db.comments[assetId].unshift(comment);
    
    const asset = db.assets.find(a => a.id === assetId);
    if (asset) {
      if (!asset.comments) asset.comments = [];
      asset.comments.unshift(comment);
    }
    
    await writeDb(db);
  },

  async incrementDownload(assetId: string) {
    const db = await readDb();
    const asset = db.assets.find(a => a.id === assetId);
    if (asset) {
      asset.downloadCount = (asset.downloadCount || 0) + 1;
      await writeDb(db);
    }
  },

  async deleteAsset(assetId: string) {
    const db = await readDb();
    db.assets = db.assets.filter(a => a.id !== assetId);
    await writeDb(db);
  }
};
