
import { Asset, Comment } from '../types';

const GITHUB_TOKEN = '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';
const OWNER = 'FISTOFDARKNESS';
const REPO = 'excaliburstore';
const BASE_PATH = 'Marketplace/Assets';
const REGISTRY_PATH = 'Marketplace/registry.json';

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

  async getRegistry(): Promise<{ assets: Asset[], sha?: string }> {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${REGISTRY_PATH}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      if (!res.ok) return { assets: [] };
      const json = await res.json();
      // Decode with UTF-8 support
      const content = decodeURIComponent(escape(atob(json.content)));
      return { 
        assets: JSON.parse(content), 
        sha: json.sha 
      };
    } catch {
      return { assets: [] };
    }
  },

  async updateRegistry(newAsset: Asset) {
    const { assets, sha } = await this.getRegistry();
    const updatedAssets = [newAsset, ...assets.filter(a => a.id !== newAsset.id)];
    // Encode with UTF-8 support
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(updatedAssets, null, 2))));
    await this.uploadToRepo(
      REGISTRY_PATH,
      content,
      `Update registry: ${newAsset.title}`,
      sha
    );
  },

  async uploadAsset(asset: Asset, files: { asset: File, thumb: File, video: File }) {
    const assetId = asset.id;
    const folderPath = `${BASE_PATH}/${assetId}`;

    await this.ensureBasePath();

    const thumbExt = getExtension(files.thumb.name) || 'png';
    const videoExt = getExtension(files.video.name) || 'mp4';
    const assetExt = getExtension(files.asset.name) || 'rbxm';

    const thumbName = `thumbnail.${thumbExt}`;
    const videoName = `preview.${videoExt}`;
    const assetName = `file.${assetExt}`;

    // Upload binaries com as extensões corretas
    await this.uploadToRepo(`${folderPath}/${thumbName}`, await toBase64(files.thumb), `Thumb: ${assetId}`);
    await this.uploadToRepo(`${folderPath}/${videoName}`, await toBase64(files.video), `Video: ${assetId}`);
    await this.uploadToRepo(`${folderPath}/${assetName}`, await toBase64(files.asset), `File: ${assetId}`);

    const metadata: Asset = {
      ...asset,
      thumbnailUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/${thumbName}`,
      videoUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/${videoName}`,
      fileUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/${assetName}`
    };

    // Save individual metadata
    const metaContent = btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 2))));
    await this.uploadToRepo(`${folderPath}/metadata.json`, metaContent, `Meta: ${assetId}`);
    
    // Update global registry
    await this.updateRegistry(metadata);
    
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
        branch: 'main',
        ...(sha ? { sha } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Github Operation Failed');
    }
    return await response.json();
  },

  async updateAssetInRegistry(assetId: string, updater: (current: Asset) => Asset) {
    const { assets, sha } = await this.getRegistry();
    const index = assets.findIndex(a => a.id === assetId);
    if (index === -1) throw new Error("Asset not found in registry");
    
    const updated = updater(assets[index]);
    assets[index] = updated;

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(assets, null, 2))));
    await this.uploadToRepo(
      REGISTRY_PATH,
      content,
      `Sync Registry: ${assetId}`,
      sha
    );
    return updated;
  },

  async toggleLike(assetId: string, userId: string) {
    return this.updateAssetInRegistry(assetId, (current) => {
      const likes = current.likes || [];
      const hasLiked = likes.includes(userId);
      return {
        ...current,
        likes: hasLiked ? likes.filter(id => id !== userId) : [...likes, userId]
      };
    });
  },

  async incrementDownload(assetId: string) {
    return this.updateAssetInRegistry(assetId, (current) => ({
      ...current,
      downloadCount: (current.downloadCount || 0) + 1
    }));
  },

  async addComment(assetId: string, comment: Comment) {
    return this.updateAssetInRegistry(assetId, (current) => ({
      ...current,
      comments: [comment, ...(current.comments || [])]
    }));
  },

  async getAllAssets(): Promise<Asset[]> {
    const { assets } = await this.getRegistry();
    return assets;
  }
};
