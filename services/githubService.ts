
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
  async fetchWithNoCache(url: string, options: RequestInit = {}) {
    const defaultHeaders = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    return fetch(`${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      cache: 'no-store'
    });
  },

  async uploadToRepo(path: string, content: string, message: string, sha?: string) {
    const response = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
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
      const res = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${REGISTRY_PATH}`);
      if (res.status === 404) return { data: {} };
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
      const res = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const json = await res.json();
      const content = decodeURIComponent(escape(atob(json.content)));
      return { user: JSON.parse(content), sha: json.sha };
    } catch {
      return null;
    }
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const res = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${USERS_PATH}`);
      if (res.status === 404) return [];
      if (!res.ok) return [];
      const folders = (await res.json()).filter((i: any) => i.type === 'dir');
      const results = await Promise.allSettled(folders.map((f: any) => this.getUserProfile(f.name)));
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
        .map(r => r.value.user);
    } catch { return []; }
  },

  async syncUserProfile(user: Partial<User>): Promise<User> {
    if (!user.id) throw new Error("User ID required");
    const existing = await this.getUserProfile(user.id);
    const registry = await this.getUsernameRegistry();
    
    let finalName = user.name || "Unknown User";
    let email = user.email || "";

    if (user.id === "108578027243443196278" && !existing) {
        finalName = "EXCALIBUR";
        email = "kaioadrik08@gmail.com";
    }

    if (!existing) {
      const isTaken = Object.keys(registry.data).find(name => name.toLowerCase() === finalName.toLowerCase() && registry.data[name] !== user.id);
      if (isTaken) {
        finalName = `${finalName}#${Math.floor(1000 + Math.random() * 9000)}`;
      }
      registry.data[finalName] = user.id;
      const regContent = btoa(unescape(encodeURIComponent(JSON.stringify(registry.data, null, 2))));
      await this.uploadToRepo(REGISTRY_PATH, regContent, `Register name: ${finalName}`, registry.sha);
    }

    const isAdminUser = (email === 'kaioadrik08@gmail.com') || (existing?.user.isAdmin || false);

    const newUser: User = {
      id: user.id,
      name: existing?.user.name || finalName,
      isAdmin: isAdminUser,
      email: email,
      avatar: existing?.user.avatar || user.avatar || "https://lh3.googleusercontent.com/a/ACg8ocIG6atjZk3j17lrPesukyA0RGHDlAQTPSSTRUEMRsDFdRIhXv4=s96-c",
      joinedAt: existing?.user.joinedAt || (user.id === "108578027243443196278" ? 1771340403300 : Date.now()),
      isVerified: existing?.user.isVerified || false,
      isBanned: existing?.user.isBanned || false,
      followers: existing?.user.followers || [],
      following: existing?.user.following || []
    };

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(newUser, null, 2))));
    await this.uploadToRepo(`${USERS_PATH}/${user.id}/profile.json`, content, `Sync Profile: ${user.id}`, existing?.sha);
    return newUser;
  },

  async toggleBan(userId: string) {
    const data = await this.getUserProfile(userId);
    if (!data) throw new Error("User not found");
    const updated = { ...data.user, isBanned: !data.user.isBanned };
    await this.uploadToRepo(
      `${USERS_PATH}/${userId}/profile.json`,
      btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2)))),
      `Toggle Ban: ${userId}`,
      data.sha
    );
    return updated;
  },

  async verifyUser(userId: string, status: boolean) {
    const data = await this.getUserProfile(userId);
    if (!data) throw new Error("User not found");
    const updated = { ...data.user, isVerified: status };
    await this.uploadToRepo(`${USERS_PATH}/${userId}/profile.json`, btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2)))), `Set Verified: ${status}`, data.sha);
    return updated;
  },

  async getAssetMetadata(assetId: string): Promise<{ asset: Asset, sha: string } | null> {
    try {
      const path = `${BASE_PATH}/${assetId}/metadata.json`;
      const res = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`);
      if (res.status === 404) return null;
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

  async getAllAssets(): Promise<Asset[]> {
    try {
      const res = await this.fetchWithNoCache(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}`);
      if (res.status === 404) return [];
      if (!res.ok) return [];
      const folders = (await res.json()).filter((i: any) => i.type === 'dir');
      const results = await Promise.allSettled(folders.map((f: any) => this.getAssetMetadata(f.name)));
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
        .map(r => r.value.asset);
    } catch { return []; }
  }
};
