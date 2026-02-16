
import { neon } from '@neondatabase/serverless';
import { Asset, User, Category } from '../types';

/**
 * Serviço de integração com o Neon PostgreSQL.
 * Utiliza o padrão de Tagged Templates do Neon para segurança contra SQL Injection 
 * e compatibilidade total de tipos com o driver serverless.
 */

const DATABASE_URL = "postgresql://neondb_owner:npg_ZIigvq76hfeD@ep-lucky-night-ahauzl87-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Instância do driver Neon
const sql = neon(DATABASE_URL);

export const neonDb = {
  // Busca todos os assets com informações básicas e mapeia para a interface Asset
  async getAllAssets(): Promise<Asset[]> {
    const rows = await sql`SELECT * FROM assets ORDER BY timestamp DESC`;
    // Mapeia snake_case do DB para camelCase do Asset e garante campos obrigatórios da interface
    return (rows || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      title: row.title,
      description: row.description || "",
      category: row.category as Category,
      thumbnailUrl: row.thumbnail_url,
      fileData: row.file_data,
      fileType: row.file_type as ('.rbxm' | '.rbxl' | '.rbxmx'),
      downloadCount: Number(row.download_count || 0),
      timestamp: Number(row.timestamp || Date.now()),
      likes: [],
      dislikes: [],
      reports: [],
      comments: [],
      creditsRequired: false
    }));
  },

  // Busca todos os usuários e mapeia para a interface User
  async getAllUsers(): Promise<User[]> {
    const rows = await sql`SELECT * FROM users`;
    // Mapeia snake_case do DB para camelCase do User e garante campos obrigatórios
    return (rows || []).map(row => ({
      id: row.id,
      name: row.name,
      username: row.username,
      avatar: row.avatar,
      provider: 'google', // Default provider
      followers: [],
      following: [],
      bio: row.bio || ""
    }));
  },

  // Busca comentários de um asset
  async getComments(assetId: string) {
    return await sql`SELECT * FROM comments WHERE asset_id = ${assetId} ORDER BY timestamp DESC`;
  },

  // Upsert de usuário (insere ou atualiza se já existir)
  async saveUser(user: User) {
    const ts = Date.now();
    return await sql`
      INSERT INTO users (id, name, username, avatar, bio, timestamp) 
      VALUES (${user.id}, ${user.name}, ${user.username}, ${user.avatar}, ${user.bio || ""}, ${ts})
      ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name, avatar = EXCLUDED.avatar, bio = EXCLUDED.bio
    `;
  },

  // Salva um novo asset
  async saveAsset(asset: Asset | any) {
    return await sql`
      INSERT INTO assets (id, user_id, author_name, author_avatar, title, description, category, thumbnail_url, file_data, file_type, download_count, timestamp)
      VALUES (${asset.id}, ${asset.userId}, ${asset.authorName}, ${asset.authorAvatar}, ${asset.title}, ${asset.description}, ${asset.category}, ${asset.thumbnailUrl}, ${asset.fileData}, ${asset.fileType}, ${asset.downloadCount || 0}, ${asset.timestamp})
    `;
  },

  // Adiciona comentário
  async saveComment(comment: any, assetId: string) {
    return await sql`
      INSERT INTO comments (id, asset_id, user_id, user_name, user_avatar, text, timestamp)
      VALUES (${comment.id}, ${assetId}, ${comment.userId}, ${comment.userName}, ${comment.userAvatar}, ${comment.text}, ${comment.timestamp})
    `;
  },

  // Incrementa download
  async incrementDownload(assetId: string) {
    return await sql`UPDATE assets SET download_count = download_count + 1 WHERE id = ${assetId}`;
  },

  // Deleta asset
  async deleteAsset(assetId: string) {
    return await sql`DELETE FROM assets WHERE id = ${assetId}`;
  }
};
