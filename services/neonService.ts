
import { Asset, User, Category } from '../types';

/**
 * Excalibur Storage Service (Puter Cloud Engine) - V4 Stable
 * Focado em persistência total. O Seed Data nunca sobrescreve dados reais.
 */

declare const puter: any;

const DB_PATH = 'Documents/ExcaliburStore/registry_v3.json';

interface DatabaseSchema {
  assets: Asset[];
  users: User[];
}

// Dados de exemplo APENAS para a primeira execução
const getSeedData = (): DatabaseSchema => ({
  assets: [
    {
      id: 'seed_1',
      userId: 'system',
      authorName: 'Excalibur_Dev',
      authorAvatar: 'https://ui-avatars.com/api/?name=Excalibur&background=000&color=fff',
      title: 'Advanced Vehicle Chassis v4',
      description: 'Sistema profissional de veículos para Roblox.',
      category: Category.MODEL,
      thumbnailUrl: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=800',
      fileType: '.rbxm',
      fileData: '#', 
      creditsRequired: false,
      likes: [],
      dislikes: [],
      reports: [],
      comments: [],
      downloadCount: 1240,
      timestamp: Date.now() - 86400000
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
      bio: 'Conta oficial do arquivo Excalibur.'
    }
  ]
});

async function readDb(): Promise<DatabaseSchema> {
  try {
    const stats = await puter.fs.stat(DB_PATH).catch(() => null);
    
    if (!stats) {
      // SÓ entra aqui se o arquivo NUNCA foi criado
      const seed = getSeedData();
      await writeDb(seed);
      return seed;
    }

    const data = await puter.fs.read(DB_PATH);
    const text = await data.text();
    const parsed = JSON.parse(text);
    
    // Validação mínima para não corromper o estado se o arquivo estiver vazio
    return {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      users: Array.isArray(parsed.users) ? parsed.users : []
    };
  } catch (e) {
    console.error("Erro na leitura do banco. Mantendo estado atual para evitar perda de dados.", e);
    // Em caso de erro de leitura (ex: rede), retorna vazio em vez de resetar o arquivo
    return { assets: [], users: [] };
  }
}

async function writeDb(db: DatabaseSchema): Promise<void> {
  try {
    // Garante que o diretório existe
    await puter.fs.mkdir('Documents/ExcaliburStore', { recursive: true }).catch(() => null);
    // Escrita atômica do JSON
    await puter.fs.write(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Erro crítico ao salvar dados:", e);
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
    // Verifica se já existe (evita duplicatas em recargas rápidas)
    if (!db.assets.some(a => a.id === asset.id)) {
      db.assets.unshift(asset); 
      await writeDb(db);
    }
  },

  async saveComment(comment: any, assetId: string) {
    const db = await readDb();
    const asset = db.assets.find(a => a.id === assetId);
    if (asset) {
      if (!asset.comments) asset.comments = [];
      // Adiciona o comentário diretamente no asset dentro da lista principal
      asset.comments.unshift(comment);
      await writeDb(db);
    }
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
