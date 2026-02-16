
import { Asset, User, Category } from '../types';

/**
 * Excalibur Storage Service
 * Migrated from Neon to Puter.js for better security and reliability in frontend-only environments.
 * Stores data in the user's Puter Documents folder.
 */

declare const puter: any;

const DB_PATH = 'Documents/ExcaliburStore/registry_v3.json';

interface DatabaseSchema {
  assets: Asset[];
  users: User[];
  comments: Record<string, any[]>;
}

const getInitialDb = (): DatabaseSchema => ({
  assets: [],
  users: [],
  comments: {}
});

async function readDb(): Promise<DatabaseSchema> {
  try {
    const data = await puter.fs.read(DB_PATH);
    const text = await data.text();
    return JSON.parse(text);
  } catch (e) {
    // If file doesn't exist, return empty schema
    return getInitialDb();
  }
}

async function writeDb(db: DatabaseSchema): Promise<void> {
  try {
    // Ensure directory exists
    await puter.fs.mkdir('Documents/ExcaliburStore', { recursive: true });
    await puter.fs.write(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Storage Error:", e);
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
    db.assets.unshift(asset); // Newest first
    await writeDb(db);
  },

  async saveComment(comment: any, assetId: string) {
    const db = await readDb();
    if (!db.comments[assetId]) db.comments[assetId] = [];
    db.comments[assetId].unshift(comment);
    
    // Also update the asset's internal comment list for consistency in the UI
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
