
import { neon } from '@neondatabase/serverless';

/**
 * Serviço de integração com o Neon PostgreSQL via Driver Serverless oficial.
 * Este driver resolve problemas de CORS e autenticação HTTP automaticamente.
 */

const DATABASE_URL = "postgresql://neondb_owner:npg_ZIigvq76hfeD@ep-lucky-night-ahauzl87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Instância do driver Neon
const sql = neon(DATABASE_URL);

async function executeQuery(query: string, params: any[] = []) {
  try {
    // O driver neon lida com o fetch interno, headers e segurança.
    const result = await sql(query, params);
    return result;
  } catch (err) {
    console.error("Neon DB Execution Error:", err);
    throw err;
  }
}

export const neonDb = {
  // Busca todos os assets com informações básicas
  async getAllAssets() {
    return await executeQuery("SELECT * FROM assets ORDER BY timestamp DESC");
  },

  // Busca todos os usuários
  async getAllUsers() {
    return await executeQuery("SELECT * FROM users");
  },

  // Busca comentários de um asset
  async getComments(assetId: string) {
    return await executeQuery("SELECT * FROM comments WHERE asset_id = $1 ORDER BY timestamp DESC", [assetId]);
  },

  // Upsert de usuário (insere ou atualiza se já existir)
  async saveUser(user: any) {
    return await executeQuery(
      `INSERT INTO users (id, name, username, avatar, bio, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET 
       name = EXCLUDED.name, avatar = EXCLUDED.avatar, bio = EXCLUDED.bio`,
      [user.id, user.name, user.username, user.avatar, user.bio || "", Date.now()]
    );
  },

  // Salva um novo asset
  async saveAsset(asset: any) {
    return await executeQuery(
      `INSERT INTO assets (id, user_id, author_name, author_avatar, title, description, category, thumbnail_url, file_data, file_type, download_count, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [asset.id, asset.userId, asset.authorName, asset.authorAvatar, asset.title, asset.description, asset.category, asset.thumbnailUrl, asset.fileData, asset.fileType, 0, asset.timestamp]
    );
  },

  // Adiciona comentário
  async saveComment(comment: any, assetId: string) {
    return await executeQuery(
      `INSERT INTO comments (id, asset_id, user_id, user_name, user_avatar, text, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [comment.id, assetId, comment.userId, comment.userName, comment.userAvatar, comment.text, comment.timestamp]
    );
  },

  // Incrementa download
  async incrementDownload(assetId: string) {
    return await executeQuery("UPDATE assets SET download_count = download_count + 1 WHERE id = $1", [assetId]);
  },

  // Deleta asset
  async deleteAsset(assetId: string) {
    return await executeQuery("DELETE FROM assets WHERE id = $1", [assetId]);
  }
};
