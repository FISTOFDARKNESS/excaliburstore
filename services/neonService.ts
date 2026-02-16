
import { Asset, User, Category } from '../types';

/**
 * Excalibur Storage Service (Puter Cloud Engine) - V5 Ultra-Persistent
 * Sistema projetado para NUNCA apagar dados do usuário.
 */

declare const puter: any;

const DB_PATH = 'Documents/ExcaliburStore/registry_v3.json';

interface DatabaseSchema {
  assets: Asset[];
  users: User[];
}

// Retorna apenas a estrutura básica se for realmente o primeiro uso
const getEmptySchema = (): DatabaseSchema => ({
  assets: [],
  users: []
});

async function readDb(): Promise<DatabaseSchema> {
  try {
    // 1. Verifica se o arquivo existe
    const stats = await puter.fs.stat(DB_PATH).catch(() => null);
    
    if (!stats) {
      return getEmptySchema();
    }

    // 2. Tenta ler o arquivo
    const data = await puter.fs.read(DB_PATH);
    if (!data) throw new Error("Falha crítica: Arquivo existe mas a leitura retornou nulo.");
    
    const text = await data.text();
    const parsed = JSON.parse(text);
    
    // 3. Validação rigorosa: se o JSON estiver malformado, não retorna lista vazia para não sobrescrever
    if (!parsed || typeof parsed !== 'object') {
      throw new Error("JSON corrompido ou inválido detectado.");
    }

    return {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      users: Array.isArray(parsed.users) ? parsed.users : []
    };
  } catch (e) {
    // IMPORTANTE: Lançamos o erro para que o App.tsx saiba que NÃO deve limpar a tela
    console.error("ERRO DE LEITURA (DADOS PRESERVADOS NO DISCO):", e);
    throw e; 
  }
}

async function writeDb(db: DatabaseSchema): Promise<void> {
  try {
    // Trava de segurança: impede salvar se o banco estiver nulo
    if (!db || !db.assets) return;

    await puter.fs.mkdir('Documents/ExcaliburStore', { recursive: true }).catch(() => null);
    await puter.fs.write(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("ERRO AO GRAVAR (OPERAÇÃO ABORTADA PARA SEGURANÇA):", e);
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
    try {
      const db = await readDb();
      const index = db.users.findIndex(u => u.id === user.id);
      if (index > -1) {
        db.users[index] = { ...db.users[index], ...user };
      } else {
        db.users.push(user);
      }
      await writeDb(db);
    } catch (e) {
      console.error("saveUser abortado por erro de leitura prévia.");
    }
  },

  async saveAsset(asset: Asset) {
    try {
      const db = await readDb();
      if (!db.assets.some(a => a.id === asset.id)) {
        db.assets.unshift(asset); 
        await writeDb(db);
      }
    } catch (e) {
      console.error("saveAsset abortado para evitar corrupção de dados.");
      throw e;
    }
  },

  async saveComment(comment: any, assetId: string) {
    try {
      const db = await readDb();
      const asset = db.assets.find(a => a.id === assetId);
      if (asset) {
        if (!asset.comments) asset.comments = [];
        asset.comments.unshift(comment);
        await writeDb(db);
      }
    } catch (e) {
      console.error("saveComment abortado.");
    }
  },

  async incrementDownload(assetId: string) {
    try {
      const db = await readDb();
      const asset = db.assets.find(a => a.id === assetId);
      if (asset) {
        asset.downloadCount = (asset.downloadCount || 0) + 1;
        await writeDb(db);
      }
    } catch (e) {
      console.error("incrementDownload abortado.");
    }
  },

  async deleteAsset(assetId: string) {
    try {
      const db = await readDb();
      db.assets = db.assets.filter(a => a.id !== assetId);
      await writeDb(db);
    } catch (e) {
      console.error("deleteAsset abortado.");
    }
  }
};
