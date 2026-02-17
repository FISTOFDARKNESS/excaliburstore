
import { Asset, Comment, User } from '../types';

const GITHUB_TOKEN = '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';
const OWNER = 'FISTOFDARKNESS';
const REPO = 'excaliburstore';
const BRANCH = 'main';
const BASE_PATH = 'Marketplace/Assets';
const USERS_PATH = 'Marketplace/Users';
const REGISTRY_PATH = 'Marketplace/Registry/usernames.json';

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

const getExtension = (filename: string) => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

export const githubStorage = {
  async uploadToRepo(path: string, content: string, message: string, sha?: string) {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Github Operation Failed');
    }
    return await response.json();
  },

  async getUsernameRegistry(): Promise<{ data: Record<string, string>, sha?: string }> {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${REGISTRY_PATH}?t=${Date.now()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (!res.ok) return { data: {} };
      const json = await res.json();
      const content = decodeURIComponent(escape(atob(json.content)));
      return { data: JSON.parse(content), sha: json.sha };
    } catch {
      return { data: {} };
    }
  },

  async getUserProfile(userId: string): Promise<{ user: User, sha: string } | null> {
    try {
      const path = `${USERS_PATH}/${userId}/profile.json`;
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?t=${Date.now()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (!res.ok) return null;
      const json = await res.json();
      const content = decodeURIComponent(escape(atob(json.content)));
      return { user: JSON.parse(content), sha: json.sha };
    } catch {
      return null;
    }
  },

  async syncUserProfile(user: Partial<User>): Promise<User> {
    if (!user.id) throw new Error("User ID required");
    const existing = await this.getUserProfile(user.id);
    const registry = await this.getUsernameRegistry();
    
    let finalName = user.name || "Unknown User";

    // Se é um novo usuário, verificar se o nome do Google já está em uso
    if (!existing) {
      const isTaken = Object.keys(registry.data).find(name => name.toLowerCase() === finalName.toLowerCase() && registry.data[name] !== user.id);
      if (isTaken) {
        finalName = `${finalName}#${Math.floor(1000 + Math.random() * 9000)}`;
      }
      // Registrar no global
      registry.data[finalName] = user.id;
      const regContent = btoa(unescape(encodeURIComponent(JSON.stringify(registry.data, null, 2))));
      await this.uploadToRepo(REGISTRY_PATH, regContent, `Register name: ${finalName}`, registry.sha);
    }

    const newUser: User = {
      id: user.id,
      name: existing?.user.name || finalName,
      email: user.email || "",
      avatar: user.avatar || "",
      joinedAt: existing?.user.joinedAt || Date.now(),
      isVerified: existing?.user.isVerified || false,
      followers: existing?.user.followers || [],
      following: existing?.user.following || []
    };

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(newUser, null, 2))));
    await this.uploadToRepo(`${USERS_PATH}/${user.id}/profile.json`, content, `Sync Profile: ${user.id}`, existing?.sha);
    return newUser;
  },

  async changeUsername(userId: string, newName: string): Promise<User> {
    const registry = await this.getUsernameRegistry();
    const existingUser = await this.getUserProfile(userId);
    if (!existingUser) throw new Error("Usuário não encontrado");

    const normalizedNew = newName.trim();
    const isTaken = Object.keys(registry.data).find(name => name.toLowerCase() === normalizedNew.toLowerCase() && registry.data[name] !== userId);
    
    if (isTaken) throw new Error("Este nome já está em uso por outro agente.");

    // 1. Remover nome antigo do registro
    const oldName = existingUser.user.name;
    delete registry.data[oldName];
    
    // 2. Adicionar novo nome
    registry.data[normalizedNew] = userId;

    // 3. Atualizar Registro Global
    const regContent = btoa(unescape(encodeURIComponent(JSON.stringify(registry.data, null, 2))));
    await this.uploadToRepo(REGISTRY_PATH, regContent, `Update Registry: ${oldName} -> ${normalizedNew}`, registry.sha);

    // 4. Atualizar Perfil do Usuário
    const updatedUser = { ...existingUser.user, name: normalizedNew };
    const userContent = btoa(unescape(encodeURIComponent(JSON.stringify(updatedUser, null, 2))));
    await this.uploadToRepo(`${USERS_PATH}/${userId}/profile.json`, userContent, `Update Name: ${normalizedNew}`, existingUser.sha);

    return updatedUser;
  },

  async toggleFollow(actorId: string, targetId: string) {
    const actorData = await this.getUserProfile(actorId);
    const targetData = await this.getUserProfile(targetId);

    if (!actorData || !targetData) throw new Error("Profiles not found");

    const isFollowing = actorData.user.following.includes(targetId);
    
    const newFollowing = isFollowing 
      ? actorData.user.following.filter(id => id !== targetId)
      : [...actorData.user.following, targetId];
    
    await this.uploadToRepo(
      `${USERS_PATH}/${actorId}/profile.json`,
      btoa(unescape(encodeURIComponent(JSON.stringify({ ...actorData.user, following: newFollowing }, null, 2)))),
      `Update Following: ${targetId}`,
      actorData.sha
    );

    const newFollowers = isFollowing
      ? targetData.user.followers.filter(id => id !== actorId)
      : [...targetData.user.followers, actorId];

    await this.uploadToRepo(
      `${USERS_PATH}/${targetId}/profile.json`,
      btoa(unescape(encodeURIComponent(JSON.stringify({ ...targetData.user, followers: newFollowers }, null, 2)))),
      `Update Followers: ${actorId}`,
      targetData.sha
    );
  },

  async verifyUser(userId: string, status: boolean) {
    const data = await this.getUserProfile(userId);
    if (!data) throw new Error("User not found");
    
    const updated = { ...data.user, isVerified: status };
    await this.uploadToRepo(
      `${USERS_PATH}/${userId}/profile.json`,
      btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2)))),
      `Set Verified: ${status}`,
      data.sha
    );
  },

  async getAssetMetadata(assetId: string): Promise<{ asset: Asset, sha: string } | null> {
    try {
      const path = `${BASE_PATH}/${assetId}/metadata.json`;
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?t=${Date.now()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (!res.ok) return null;
      const json = await res.json();
      const content = decodeURIComponent(escape(atob(json.content)));
      return { asset: JSON.parse(content), sha: json.sha };
    } catch { return null; }
  },

  async uploadAsset(asset: Asset, files: { asset: File, thumb: File, video: File }, onProgress?: (msg: string) => void) {
    const assetId = asset.id;
    const folderPath = `${BASE_PATH}/${assetId}`;
    
    const authorProfile = await this.getUserProfile(asset.userId);

    const thumbExt = getExtension(files.thumb.name) || 'png';
    const videoExt = getExtension(files.video.name) || 'mp4';
    const assetExt = getExtension(files.asset.name) || 'rbxm';

    if (onProgress) onProgress('Transmitindo Thumbnail...');
    await this.uploadToRepo(`${folderPath}/thumbnail.${thumbExt}`, await toBase64(files.thumb), `Thumb: ${assetId}`);
    
    if (onProgress) onProgress('Transmitindo Vídeo...');
    await this.uploadToRepo(`${folderPath}/preview.${videoExt}`, await toBase64(files.video), `Video: ${assetId}`);
    
    if (onProgress) onProgress('Transmitindo Binário...');
    await this.uploadToRepo(`${folderPath}/file.${assetExt}`, await toBase64(files.asset), `File: ${assetId}`);

    const metadata: Asset = {
      ...asset,
      authorVerified: authorProfile?.user.isVerified || false,
      thumbnailUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/thumbnail.${thumbExt}`,
      videoUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/preview.${videoExt}`,
      fileUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/file.${assetExt}`
    };

    if (onProgress) onProgress('Finalizando Metadados...');
    await this.uploadToRepo(`${folderPath}/metadata.json`, btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 2)))), `Meta: ${assetId}`);
    return metadata;
  },

  async updateAssetMetadata(assetId: string, updater: (current: Asset) => Asset) {
    const data = await this.getAssetMetadata(assetId);
    if (!data) throw new Error("Asset not found");
    const updated = updater(data.asset);
    await this.uploadToRepo(`${BASE_PATH}/${assetId}/metadata.json`, btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2)))), `Update: ${assetId}`, data.sha);
    return updated;
  },

  async toggleLike(assetId: string, userId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({
      ...current,
      likes: current.likes.includes(userId) ? current.likes.filter(id => id !== userId) : [...current.likes, userId]
    }));
  },

  async incrementDownload(assetId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({ ...current, downloadCount: (current.downloadCount || 0) + 1 }));
  },

  async incrementReport(assetId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({ ...current, reports: (current.reports || 0) + 1 }));
  },

  async addComment(assetId: string, comment: Comment) {
    return this.updateAssetMetadata(assetId, (current) => ({ ...current, comments: [comment, ...(current.comments || [])] }));
  },

  async removeAsset(assetId: string) {
    const folderPath = `${BASE_PATH}/${assetId}`;
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${folderPath}`, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
    if (res.ok) {
      const files = await res.json();
      for (const file of files) {
        await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.path}`, {
          method: 'DELETE',
          headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Delete asset ${assetId}`, sha: file.sha, branch: BRANCH })
        });
      }
    }
  },

  async getAllAssets(): Promise<Asset[]> {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}?t=${Date.now()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (!res.ok) return [];
      const folders = (await res.json()).filter((i: any) => i.type === 'dir');
      const results = await Promise.allSettled(folders.map((f: any) => this.getAssetMetadata(f.name)));
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
        .map(r => r.value.asset);
    } catch { return []; }
  }
};
