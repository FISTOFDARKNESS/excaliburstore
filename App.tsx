
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, VerificationData, Comment } from './types';
import { Icons } from './constants';
// Import semantic search service powered by Gemini
import { getSearchKeywords } from './services/geminiService';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const ADMIN_EMAIL = "kaioadrik08@gmail.com";
const REGISTRY_KV_KEY = 'excalibur_global_registry_v4';

declare const puter: any;

// --- Global API Helpers ---

/**
 * Robust helper to get a public URL from Puter FS, handling naming variations in v2.
 */
const safeGetPublicUrl = async (path: string): Promise<string> => {
  try {
    if (typeof puter.fs.get_public_url === 'function') {
      return await puter.fs.get_public_url(path);
    } else if (typeof puter.fs.getPublicUrl === 'function') {
      return await puter.fs.getPublicUrl(path);
    } else if (typeof puter.fs.share === 'function') {
      const shared = await puter.fs.share(path);
      return shared.url || shared;
    }
    throw new Error("Puter FS public URL method not found.");
  } catch (e) {
    console.error("Failed to get public URL for:", path, e);
    // Return a local blob as last resort, though it won't work cross-device
    const blob = await puter.fs.read(path);
    return URL.createObjectURL(blob);
  }
};

/**
 * Saves the registry (users and assets) to Puter's Key-Value store.
 */
const saveGlobalState = async (users: User[], assets: Asset[]) => {
  try {
    const data = JSON.stringify({ users, assets });
    await puter.kv.set(REGISTRY_KV_KEY, data);
  } catch (e) {
    console.error("Failed to sync global state to Puter KV:", e);
  }
};

/**
 * Loads the registry from Puter's Key-Value store.
 */
const loadGlobalState = async (): Promise<{ users: User[], assets: Asset[] } | null> => {
  try {
    const data = await puter.kv.get(REGISTRY_KV_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load global state from Puter KV:", e);
    return null;
  }
};

/**
 * Uploads a file and ensures it has a public URL for cross-device access.
 */
const uploadAndGetPublicUrl = async (file: File, folder: string = 'PublicAssets'): Promise<string> => {
  try {
    const dir = `Documents/ExcaliburCloud/${folder}`;
    try {
      await puter.fs.mkdir(dir, { recursive: true });
    } catch (e) {}

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const path = `${dir}/${fileName}`;
    
    await puter.fs.write(path, file);
    return await safeGetPublicUrl(path);
  } catch (err: any) {
    console.error("Upload Error:", err);
    throw new Error(err.message || "Failed to upload file to cloud.");
  }
};

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) { return null; }
};

// --- Components ---

const AssetRow: React.FC<{
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-xl p-3 flex items-center gap-3 cursor-pointer group w-full hover:bg-white/[0.03] border border-white/5">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={asset.title} loading="lazy" />
      {asset.reports.length > 0 && (
        <div className="absolute top-1 left-1 bg-red-600 text-white px-1 py-0.5 rounded text-[7px] font-black flex items-center gap-0.5 shadow-lg">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z"/></svg>
          {asset.reports.length}
        </div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-base text-white truncate group-hover:text-blue-400 transition-colors tracking-tight italic uppercase">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors">
          @{asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 text-zinc-600">
         <span className="text-[9px] font-bold">{asset.downloadCount}</span>
         <Icons.Download />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white text-black px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-90 transition-all">
        GET
      </button>
    </div>
  </div>
);

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  // Initial Boot: Load from Global KV Store
  useEffect(() => {
    const boot = async () => {
      const storedLocalUser = localStorage.getItem('ex_cur_user_v2');
      if (storedLocalUser) setCurrentUser(JSON.parse(storedLocalUser));

      const cloudData = await loadGlobalState();
      if (cloudData) {
        setUsers(cloudData.users || []);
        setAssets(cloudData.assets || []);
      }
      setIsCloudLoaded(true);
    };
    boot();

    // Check for updates every 15 seconds
    const interval = setInterval(async () => {
      setIsSyncing(true);
      const latest = await loadGlobalState();
      if (latest) {
        setUsers(latest.users || []);
        setAssets(latest.assets || []);
      }
      setTimeout(() => setIsSyncing(false), 1000);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Sync to Global KV Store on local changes
  useEffect(() => {
    if (isCloudLoaded) {
      saveGlobalState(users, assets);
    }
  }, [users, assets, isCloudLoaded]);

  // Persist current session locally
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ex_cur_user_v2', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ex_cur_user_v2');
    }
  }, [currentUser]);

  // Semantic keyword search via Gemini
  useEffect(() => {
    const updateKeywords = async () => {
      if (searchQuery.trim().length >= 2) {
        const keywords = await getSearchKeywords(searchQuery);
        setSearchKeywords(keywords);
      } else {
        setSearchKeywords([]);
      }
    };
    const timer = setTimeout(updateKeywords, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isAdmin = useMemo(() => currentUser?.username === ADMIN_EMAIL, [currentUser]);

  const handleGoogleSignIn = useCallback((response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: User = { 
        id: payload.sub, 
        name: payload.name, 
        username: payload.email, 
        avatar: payload.picture, 
        provider: 'google', 
        followers: [], 
        following: [], 
        bio: "Global Repository Member", 
        links: [] 
      };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
    }
    setShowLoginMenu(false);
  }, [users]);

  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
      });
    }
  }, [handleGoogleSignIn]);

  const handleDownload = (asset: Asset) => {
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a));
    const a = document.createElement('a');
    a.href = asset.fileData || '';
    a.download = `${asset.title}${asset.fileType}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePublish = async (files: { thumb: File, rbx: File, data: any }) => {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      const rbxUrl = await uploadAndGetPublicUrl(files.rbx, 'Binaries');
      const thumbUrl = await uploadAndGetPublicUrl(files.thumb, 'Thumbnails');
      
      const newAsset: Asset = {
        id: 'a_' + Date.now(),
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: files.data.title,
        description: files.data.desc || "Verified Excalibur Asset.",
        category: files.data.category,
        thumbnailUrl: thumbUrl,
        fileData: rbxUrl, 
        fileType: files.rbx.name.substring(files.rbx.name.lastIndexOf('.')) as any,
        creditsRequired: false,
        likes: [],
        dislikes: [],
        reports: [],
        comments: [],
        downloadCount: 0,
        timestamp: Date.now()
      };

      setAssets(prev => [newAsset, ...prev]);
      setShowPublishModal(false);
    } catch (e: any) {
      alert("Cloud Failure: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset || (asset.userId !== currentUser?.id && !isAdmin)) return;
    if (confirm("Permanently remove this entry from the global repository?")) {
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setSelectedAssetId(null);
    }
  };

  const handleAddComment = (assetId: string) => {
    if (!currentUser) { setShowLoginMenu(true); return; }
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: 'c_' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text: newComment,
      timestamp: Date.now()
    };

    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, comments: [comment, ...a.comments] } : a));
    setNewComment('');
  };

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(a => {
      const basicMatch = a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      const semanticMatch = searchKeywords.some(kw => 
        a.title.toLowerCase().includes(kw.toLowerCase()) || 
        a.description.toLowerCase().includes(kw.toLowerCase())
      );
      return basicMatch || semanticMatch;
    });
  }, [assets, searchQuery, searchKeywords]);

  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white font-sans selection:bg-blue-500/20">
      <aside className="w-56 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-5 z-50 bg-[#050505]">
        <div className="flex items-center gap-2.5 mb-10 group cursor-pointer" onClick={() => { setActiveTab('home'); setViewingUserId(null); }}>
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"><Icons.Model /></div>
          <span className="font-bold uppercase tracking-tight text-base italic leading-none">EXCALIBUR</span>
        </div>
        <nav className="flex-grow space-y-1.5">
          {['home', 'vault', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200 ${activeTab === tab ? 'bg-white text-black rounded-lg shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'vault' ? <Icons.Script /> : <Icons.Plus />}
              {tab === 'vault' ? 'REPOSITORY' : tab === 'home' ? 'EXPLORE' : 'PROFILE'}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-5 border-t border-white/5">
          {currentUser ? (
            <div className="p-3 bg-white/5 rounded-xl space-y-2.5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <img src={currentUser.avatar} className="w-7 h-7 rounded-full border border-white/10" />
                <span className="text-[9px] font-bold truncate text-zinc-400">@{currentUser.name}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); setActiveTab('home'); }} className="w-full text-[8px] font-bold uppercase text-zinc-600 hover:text-red-500 transition-colors text-left">Logout Account</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-3 rounded-lg text-[9px] tracking-widest hover:brightness-90 transition-all shadow-lg">Login / Sign In</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-56 min-h-screen relative overflow-x-hidden">
        {activeTab === 'home' && (
          <div className="px-10 pt-20 pb-16 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="text-center space-y-0.5 relative">
                <h1 className="text-5xl font-black uppercase tracking-tighter animate-in slide-in-from-bottom duration-500 italic">Central</h1>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-ghost italic">Repository</h1>
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
                   {isSyncing ? (
                     <span className="text-[7px] font-black tracking-[0.4em] text-blue-500 uppercase animate-pulse">Syncing Cloud...</span>
                   ) : (
                     <span className="text-[7px] font-black tracking-[0.4em] text-zinc-800 uppercase">Cloud Connected</span>
                   )}
                </div>
              </div>
              <div className="relative max-w-xl mx-auto">
                <input type="text" placeholder="Search the global network..." className="w-full search-pill rounded-xl py-4 px-6 text-lg font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5 transition-all focus:border-white/10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="space-y-3.5 animate-in fade-in duration-700">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {filteredAssets.length === 0 && (
                   <div className="py-20 text-center space-y-4">
                      <p className="text-zinc-800 font-bold uppercase tracking-widest text-[10px] italic">No synchronized data found.</p>
                      <p className="text-[8px] text-zinc-600 max-w-[200px] mx-auto font-bold uppercase leading-relaxed">Ensure you are logged into the same Puter account on all devices for full synchronization.</p>
                      {!isCloudLoaded && <div className="w-4 h-4 border-2 border-white/5 border-t-white/30 rounded-full animate-spin mx-auto" />}
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="px-10 pt-20 pb-16 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-end mb-10">
                <div className="space-y-0.5">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Global Vault</h1>
                  <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-[0.4em] ml-1">Live Distributed Entries</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-5 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:brightness-90 transition-all shadow-lg">Broadcast Asset</button>}
              </div>
              <div className="space-y-3.5">
                {currentUser ? (
                  assets.filter(a => a.userId === currentUser.id).length > 0 ? (
                    assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)
                  ) : (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                      <p className="text-zinc-800 font-bold uppercase tracking-widest text-[9px]">Broadcast your first asset to the network.</p>
                    </div>
                  )
                ) : (
                  <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest mb-3.5">Connect identity to manage nodes</p>
                    <button onClick={() => setShowLoginMenu(true)} className="bg-white text-black px-5 py-2 rounded-full font-bold text-[8px] uppercase tracking-widest">Login</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-10 pt-20 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-12 pb-24">
              <div className="premium-card rounded-3xl p-8 border border-white/5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
                  <img src={targetUser.avatar} className="w-24 h-24 rounded-2xl border-4 border-white/5 shadow-xl object-cover" />
                  <div className="flex-grow text-center sm:text-left space-y-2">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{targetUser.name}</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Node: @{targetUser.username.split('@')[0]}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed font-medium max-w-sm">{targetUser.bio || "Verified member of the Excalibur network."}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-lg font-bold uppercase italic tracking-tight border-b border-white/5 pb-3">Library Contributions</h3>
                <div className="space-y-3.5">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && assets.find(a => a.id === selectedAssetId) && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-md" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            const isOwner = currentUser?.id === asset.userId;
            return (
              <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-8">
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-zinc-900">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">{asset.title}</h2>
                      <div className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 text-[7px] font-black uppercase tracking-widest">NETWORK SYNCED</div>
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed font-medium">{asset.description}</p>
                  </div>
                  <div className="pt-8 border-t border-white/5 space-y-6 pb-10">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600 italic">Global Discussion ({asset.comments.length})</h4>
                    <div className="space-y-4">
                      {currentUser && (
                        <div className="flex gap-3">
                          <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                          <div className="flex-grow space-y-2">
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500/30 h-20 resize-none placeholder:text-zinc-800" placeholder="Contribute to the conversation..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                            <button onClick={() => handleAddComment(asset.id)} className="bg-white text-black text-[8px] font-black uppercase px-4 py-2 rounded-lg tracking-widest hover:brightness-90 transition-all shadow-lg">Submit Feedback</button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-5 pb-8">
                        {asset.comments.map(c => (
                          <div key={c.id} className="flex gap-3 animate-in fade-in duration-300">
                            <img src={c.userAvatar} className="w-8 h-8 rounded-full border border-white/5" />
                            <div className="flex-grow space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-white uppercase italic">{c.userName}</span>
                                <span className="text-[7px] text-zinc-600 font-bold">{new Date(c.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-normal">{c.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-[300px] bg-[#0a0a0a] border-l border-white/5 p-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <span className="text-[8px] font-bold uppercase text-zinc-700 tracking-widest">Cloud Metadata</span>
                       <button onClick={() => setSelectedAssetId(null)} className="bg-white/5 p-1.5 rounded-full rotate-45 text-zinc-500 hover:text-white transition-colors"><Icons.Plus /></button>
                    </div>

                    <div className="space-y-3">
                      {(isOwner || isAdmin) && (
                        <button onClick={() => handleDelete(asset.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 border border-red-600/20 text-red-500 text-[9px] font-bold uppercase tracking-widest hover:bg-red-600/20 transition-all shadow-lg">Wipe Global Node</button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center shadow-inner">
                        <p className="text-xl font-bold italic tracking-tighter">{asset.downloadCount}</p>
                        <p className="text-[7px] font-bold uppercase text-zinc-700 mt-1">Downloads</p>
                      </div>
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center shadow-inner">
                        <p className="text-xs font-bold text-blue-500 uppercase">{asset.fileType.substring(1)}</p>
                        <p className="text-[7px] font-bold uppercase text-zinc-700 mt-1">Format</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl group/author cursor-pointer" onClick={() => { setViewingUserId(asset.userId); setActiveTab('profile'); setSelectedAssetId(null); }}>
                      <div className="flex items-center gap-2 mb-2">
                        <img src={asset.authorAvatar} className="w-5 h-5 rounded-full border border-white/10" />
                        <span className="text-[8px] font-bold uppercase text-zinc-400 truncate group-hover/author:text-white transition-colors">@{asset.authorName}</span>
                      </div>
                      <p className="text-[7px] text-zinc-700 uppercase font-black italic">Node Created: {new Date(asset.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:brightness-90 transition-all mt-6 shadow-2xl active:scale-95">DOWNLOAD RESOURCE</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showLoginMenu && <LoginMenu onClose={() => setShowLoginMenu(false)} />}
      {showPublishModal && <PublishModal isUploading={isUploading} onPublish={handlePublish} onClose={() => setShowPublishModal(false)} />}
    </div>
  );
}

const LoginMenu = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, []);
  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Access Node</h2>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic">Join the Distributed Repository</p>
        </div>
        <div id="google-signin-btn" className="w-full mb-6" />
        <p className="text-[8px] text-zinc-800 text-center font-bold uppercase tracking-widest leading-relaxed px-4">
          Authenticate to enable broadcast and library management across the Excalibur cloud.
        </p>
      </div>
    </div>
  );
};

const PublishModal = ({ onClose, onPublish, isUploading }: { onClose: () => void, onPublish: (files: { thumb: File, rbx: File, data: any }) => void, isUploading: boolean }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState(Category.MODEL);
  const [thumb, setThumb] = useState<File | null>(null);
  const [rbxFile, setRbxFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumb || !rbxFile) return alert("Binary data and thumbnail required.");
    onPublish({ thumb, rbx: rbxFile, data: { title, desc, category } });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-4 duration-300">
        {isUploading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="w-12 h-12 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight uppercase italic">Broadcasting Resource...</h2>
              <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest italic">Synchronizing globally with cloud nodes</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1">
                <h2 className="text-xl font-black uppercase italic text-white leading-none tracking-tight">Upload Asset</h2>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Global Excalibur Repository</p>
              </div>
              <button onClick={onClose} className="p-1.5 text-zinc-700 hover:text-white transition-all bg-white/5 rounded-full rotate-45"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Asset Label</label>
                <input required type="text" placeholder="e.g. Optimized Graphics Module" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Summary</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all h-24 resize-none placeholder:text-zinc-800" placeholder="Technical specifications..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Binary (.rbxm/.rbxl)</label>
                <label className={`w-full p-5 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-600 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <Icons.Script />
                  <span className="font-bold text-[10px] tracking-widest mt-2 uppercase">{rbxFile ? rbxFile.name : "Select Binary"}</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Cover Art</label>
                  <label className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Classification</label>
                  <select className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none text-center font-bold text-[10px] uppercase italic" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:brightness-90 transition-all shadow-2xl active:scale-95">CONFIRM GLOBAL BROADCAST</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
