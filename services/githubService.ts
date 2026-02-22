
import { Octokit } from "octokit";
import { Asset, User } from "../types";

const GITHUB_TOKEN = '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';
const OWNER = 'FISTOFDARKNESS';
const REPO = 'excaliburstore';
const BRANCH = 'main';
const BASE_PATH = 'Marketplace/Assets';
const USERS_PATH = 'Marketplace/Users';
const REGISTRY_PATH = 'Marketplace/Registry/usernames.json';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export const githubService = {
  async fetchFile(path: string) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path,
        ref: BRANCH,
        headers: { 'If-None-Match': '' } // Disable cache
      });
      
      if ('content' in data) {
        const content = atob(data.content);
        return { content: JSON.parse(content), sha: data.sha };
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  async uploadFile(path: string, content: string, message: string, sha?: string) {
    return octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path,
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: BRANCH,
      sha
    });
  },

  async uploadBinary(path: string, base64Content: string, message: string) {
    return octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path,
      message,
      content: base64Content,
      branch: BRANCH
    });
  },

  async getUserProfile(userId: string): Promise<{ user: User, sha: string } | null> {
    const res = await this.fetchFile(`${USERS_PATH}/${userId}/profile.json`);
    if (res) return { user: res.content as User, sha: res.sha };
    return null;
  },

  async syncUserProfile(user: Partial<User>): Promise<User> {
    if (!user.id) throw new Error("User ID required");
    const existing = await this.getUserProfile(user.id);
    
    const newUser: User = {
      id: user.id,
      name: existing?.user.name || user.name || "Unknown",
      email: user.email || existing?.user.email || "",
      avatar: user.avatar || existing?.user.avatar || "",
      joinedAt: existing?.user.joinedAt || Date.now(),
      isVerified: existing?.user.isVerified || false,
      isBanned: existing?.user.isBanned || false,
      isAdmin: existing?.user.isAdmin || (user.email === 'kaioadrik08@gmail.com'),
      followers: existing?.user.followers || [],
      following: existing?.user.following || []
    };

    await this.uploadFile(
      `${USERS_PATH}/${user.id}/profile.json`,
      JSON.stringify(newUser, null, 2),
      `Sync Profile: ${user.id}`,
      existing?.sha
    );

    return newUser;
  },

  async getAllAssets(): Promise<Asset[]> {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: BASE_PATH,
        ref: BRANCH
      });

      if (Array.isArray(data)) {
        const assetFolders = data.filter(item => item.type === 'dir');
        const assetPromises = assetFolders.map(async (folder) => {
          const meta = await this.fetchFile(`${BASE_PATH}/${folder.name}/metadata.json`);
          return meta ? (meta.content as Asset) : null;
        });
        
        const results = await Promise.all(assetPromises);
        return results.filter((a): a is Asset => a !== null);
      }
      return [];
    } catch {
      return [];
    }
  },

  async uploadAsset(asset: Asset, files: { asset: string, thumb: string, video: string }) {
    const folder = `${BASE_PATH}/${asset.id}`;
    
    // Sequential uploads
    await this.uploadBinary(`${folder}/thumb.png`, files.thumb, `Upload Thumb: ${asset.id}`);
    await this.uploadBinary(`${folder}/preview.mp4`, files.video, `Upload Video: ${asset.id}`);
    await this.uploadBinary(`${folder}/file${asset.fileType}`, files.asset, `Upload Binary: ${asset.id}`);
    
    const finalAsset = {
      ...asset,
      thumbnailUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folder}/thumb.png`,
      videoUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folder}/preview.mp4`,
      fileUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${folder}/file${asset.fileType}`
    };

    await this.uploadFile(`${folder}/metadata.json`, JSON.stringify(finalAsset, null, 2), `Upload Meta: ${asset.id}`);
    return finalAsset;
  },

  async updateAssetMetadata(assetId: string, updater: (current: Asset) => Asset) {
    const data = await this.fetchFile(`${BASE_PATH}/${assetId}/metadata.json`);
    if (!data) throw new Error("Asset not found");
    const updated = updater(data.content as Asset);
    await this.uploadFile(`${BASE_PATH}/${assetId}/metadata.json`, JSON.stringify(updated, null, 2), `Update: ${assetId}`, data.sha);
    return updated;
  },

  async toggleLike(assetId: string, userId: string) {
    return this.updateAssetMetadata(assetId, (current) => ({
      ...current,
      likes: current.likes.includes(userId) ? current.likes.filter(id => id !== userId) : [...current.likes, userId]
    }));
  },

  async toggleFollow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) throw new Error("Cannot follow self");

    const currentUserData = await this.getUserProfile(currentUserId);
    const targetUserData = await this.getUserProfile(targetUserId);

    if (!currentUserData || !targetUserData) throw new Error("User(s) not found");

    const isFollowing = currentUserData.user.following.includes(targetUserId);

    const updatedCurrentUser: User = {
      ...currentUserData.user,
      following: isFollowing 
        ? currentUserData.user.following.filter(id => id !== targetUserId)
        : [...currentUserData.user.following, targetUserId]
    };

    const updatedTargetUser: User = {
      ...targetUserData.user,
      followers: isFollowing
        ? targetUserData.user.followers.filter(id => id !== currentUserId)
        : [...targetUserData.user.followers, currentUserId]
    };

    await Promise.all([
      this.uploadFile(
        `${USERS_PATH}/${currentUserId}/profile.json`,
        JSON.stringify(updatedCurrentUser, null, 2),
        `Toggle Follow: ${targetUserId}`,
        currentUserData.sha
      ),
      this.uploadFile(
        `${USERS_PATH}/${targetUserId}/profile.json`,
        JSON.stringify(updatedTargetUser, null, 2),
        `Update Followers: ${currentUserId}`,
        targetUserData.sha
      )
    ]);

    return { updatedCurrentUser, updatedTargetUser };
  }
};
