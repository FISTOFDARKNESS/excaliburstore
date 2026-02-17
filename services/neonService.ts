
import { Asset, User, Comment } from '../types';

declare const puter: any;

const REGISTRY_PATH = 'Documents/ExcaliburStore/global_v3_registry.json';

interface Database {
  assets: Asset[];
  users: User[];
}

const initializeDb = async (): Promise<Database> => {
  const defaultDb: Database = { assets: [], users: [] };
  try {
    await puter.fs.mkdir('Documents/ExcaliburStore', { recursive: true }).catch(() => null);
    await puter.fs.write(REGISTRY_PATH, JSON.stringify(defaultDb));
    return defaultDb;
  } catch (e) {
    return defaultDb;
  }
};

export const storage = {
  async getDb(): Promise<Database> {
    try {
      const stats = await puter.fs.stat(REGISTRY_PATH).catch(() => null);
      if (!stats) return await initializeDb();
      
      const data = await puter.fs.read(REGISTRY_PATH);
      const text = await data.text();
      return JSON.parse(text);
    } catch (e) {
      console.error("Database Read Error", e);
      return { assets: [], users: [] };
    }
  },

  async saveDb(db: Database): Promise<void> {
    try {
      await puter.fs.write(REGISTRY_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
      console.error("Database Write Error", e);
    }
  },

  async uploadFile(file: File, subfolder: string): Promise<string> {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const path = `Documents/ExcaliburStore/${subfolder}/${fileName}`;
    await puter.fs.mkdir(`Documents/ExcaliburStore/${subfolder}`, { recursive: true }).catch(() => null);
    await puter.fs.write(path, file);
    const shared = await puter.fs.share(path);
    return typeof shared === 'string' ? shared : shared.url;
  },

  async addComment(assetId: string, comment: Comment): Promise<void> {
    const db = await this.getDb();
    const asset = db.assets.find(a => a.id === assetId);
    if (asset) {
      if (!asset.comments) asset.comments = [];
      asset.comments.unshift(comment);
      await this.saveDb(db);
    }
  },

  async incrementDownload(assetId: string): Promise<void> {
    const db = await this.getDb();
    const asset = db.assets.find(a => a.id === assetId);
    if (asset) {
      asset.downloadCount = (asset.downloadCount || 0) + 1;
      await this.saveDb(db);
    }
  }
};
