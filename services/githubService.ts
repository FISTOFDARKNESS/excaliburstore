import { Asset, Comment } from '../types';

const GITHUB_TOKEN = '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';
const OWNER = 'FISTOFDARKNESS';
const REPO = 'excaliburstore';
const BRANCH = 'main';
const BASE_PATH = 'Marketplace/Assets';

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
  async ensureBasePath() {
    try {
      const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/Marketplace`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (response.status === 404) {
        await this.uploadToRepo('Marketplace/.placeholder', btoa("Init"), "Initialize Marketplace");
      }
    } catch (e) {
      console.error("Path check failed:", e);
    }
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
      return { 
        asset: JSON.parse(content), 
        sha: json.sha 
      };
    } catch {
      return null;
    }
  },

  async uploadAsset(asset: Asset, files: { asset: File, thumb: File, video: File }, onProgress?: (msg: string) => void) {
    const assetId = asset.id;
    const folderPath = `${BASE_PATH}/${assetId}`;

    await this.ensureBasePath();

    const thumbExt = getExtension(files.thumb.name) || 'png';
    const videoExt = getExtension(files.video.name) || 'mp4';
    const assetExt = getExtension(files.asset.name) || 'rbxm';

    const thumbName = `thumbnail.${thumbExt}`;
    const videoName = `preview.${videoExt}`;
    const assetName = `file.${assetExt}`;

    if (onProgress) onProgress('Transmitindo Thumbnail...');
    await this.uploadToRepo(`${folderPath}/${thumbName}`, await toBase64(files.thumb), `Thumb: ${assetId}`);
    
    if (onProgress) onProgress('Transmitindo Showcase Vídeo...');
    await this.uploadToRepo(`${folderPath}/${videoName}`, await toBase64(files.video), `Video: ${assetId}`);
    
    if (onProgress) onProgress('Transmitindo Binário Roblox...');
    await this.uploadToRepo(`${folderPath}/${assetName}`, await toBase64(files.asset), `File: ${assetId}`);

    const metadata: Asset = {
      ...asset,
      thumbnailUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/${thumbName}`,
      videoUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/${videoName}`,
      fileUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folderPath}/${assetName}`
    };

    if (onProgress) onProgress('Gerando Metadados Individuais...');
    const metaContent = btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 2))));
    await this.uploadToRepo(`${folderPath}/metadata.json`, metaContent, `Meta: ${assetId}`);
    
    return metadata;
  },

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

  async updateAssetMetadata(assetId: string, updater: (current: Asset) => Asset) {
    const data = await this.getAssetMetadata(assetId);
    if (!data) throw new Error("Asset metadata not found");
    
    const updated = updater(data.asset);
    const path = `${BASE_PATH}/${assetId}/metadata.json`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2))));
    
    await this.uploadToRepo(path, content, `Update metadata: ${assetId}`, data.sha);
    return updated;
  },

  async toggleLike(assetId: string, userId: string) {
    return this.updateAssetMetadata(assetId, (current) => {
      const likes = current.likes || [];
      const hasLiked = likes.includes(userId);
      return {
        ...current,
        likes: hasLiked ? likes.filter(id => id !== userId) : [...likes, userId]
      };
    });
  },

  async incrementDownload(assetId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({
      ...current,
      downloadCount: (current.downloadCount || 0) + 1
    }));
  },

  async incrementReport(assetId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({
      ...current,
      reports: (current.reports || 0) + 1
    }));
  },

  async removeAsset(assetId: string) {
    const folderPath = `${BASE_PATH}/${assetId}`;
    
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${folderPath}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          for (const file of files) {
            await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.path}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Deleting file for asset ${assetId}`,
                sha: file.sha,
                branch: BRANCH
              })
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete files:", e);
      throw new Error("Could not fully remove asset files from GitHub");
    }
  },

  async getAllAssets(): Promise<Asset[]> {
    try {
      // 1. Listar diretórios em Marketplace/Assets
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}?t=${Date.now()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      
      if (!res.ok) return [];
      
      const contents = await res.json();
      const folders = contents.filter((item: any) => item.type === 'dir');
      
      // 2. Buscar metadados de cada pasta em paralelo
      const assetPromises = folders.map(async (folder: any) => {
        const metadata = await this.getAssetMetadata(folder.name);
        return metadata ? metadata.asset : null;
      });
      
      const results = await Promise.allSettled(assetPromises);
      const assets: Asset[] = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          assets.push(result.value);
        }
      });
      
      return assets;
    } catch (e) {
      console.error("Discovery error:", e);
      return [];
    }
  }
};