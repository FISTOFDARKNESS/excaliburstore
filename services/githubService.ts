
import { Asset } from '../types';

const GITHUB_TOKEN = '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';
const OWNER = 'FISTOFDARKNESS';
const REPO = 'excaliburstore';
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

export const githubStorage = {
  async uploadAsset(asset: Asset, files: { asset: File, thumb: File, video: File }) {
    const assetId = asset.id;
    const folderPath = `${BASE_PATH}/${assetId}`;

    // 1. Upload Thumbnail (renomeada)
    await this.uploadToRepo(`${folderPath}/thumb_bin`, await toBase64(files.thumb), `Upload thumb for ${assetId}`);
    
    // 2. Upload Video (renomeada)
    await this.uploadToRepo(`${folderPath}/video_bin`, await toBase64(files.video), `Upload video for ${assetId}`);
    
    // 3. Upload Binary (renomeada)
    await this.uploadToRepo(`${folderPath}/asset_bin`, await toBase64(files.asset), `Upload binary for ${assetId}`);

    // 4. Upload Metadata (O cérebro do asset no repo)
    const metadata = {
      ...asset,
      thumbnailUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/thumb_bin`,
      videoUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/video_bin`,
      fileUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${folderPath}/asset_bin`
    };

    await this.uploadToRepo(`${folderPath}/metadata.json`, btoa(JSON.stringify(metadata, null, 2)), `Upload metadata for ${assetId}`);
    
    return metadata;
  },

  async uploadToRepo(path: string, content: string, message: string) {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        branch: 'main'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Github Upload Failed');
    }
  },

  async getAllAssets(): Promise<Asset[]> {
    try {
      // List folders in Marketplace/Assets
      const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      
      if (!response.ok) return [];
      const folders = await response.json();
      
      const assetPromises = folders
        .filter((f: any) => f.type === 'dir')
        .map(async (f: any) => {
          const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${f.path}/metadata.json`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
          });
          if (!res.ok) return null;
          const meta = await res.json();
          return JSON.parse(atob(meta.content));
        });

      const results = await Promise.all(assetPromises);
      return results.filter(r => r !== null) as Asset[];
    } catch (e) {
      return [];
    }
  }
};
