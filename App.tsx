
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, VerificationData, Comment } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const ADMIN_EMAIL = "kaioadrik08@gmail.com";
const GLOBAL_DATA_PATH = 'Documents/ExcaliburCloud/repository_v1.json';

declare const puter: any;

// --- API Helpers ---

const saveGlobalState = async (users: User[], assets: Asset[]) => {
  try {
    const data = JSON.stringify({ users, assets });
    await puter.fs.write(GLOBAL_DATA_PATH, data);
  } catch (e) {
    console.error("Failed to sync global state to cloud:", e);
  }
};

const loadGlobalState = async (): Promise<{ users: User[], assets: Asset[] } | null> => {
  try {
    const blob = await puter.fs.read(GLOBAL_DATA_PATH);
    const text = await blob.text();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const uploadToCloud = async (file: File, folder: string = 'Assets'): Promise<string> => {
  try {
    const dir = `Documents/ExcaliburCloud/${folder}`;
    try {
        await puter.fs.mkdir(dir, { recursive: true });
    } catch (dirErr) {
        // Ignore if directory exists
    }

    const path = `${dir}/${Date.now()}_${file.name}`;
    await puter.fs.write(path, file);
    return path;
  } catch (err: any) {
    console.error("Internal Cloud FS Error:", err);
    throw new Error(err.message || "Failed to record file in the cloud.");
  }
};

const deleteFromCloud = async (path: string) => {
  try {
    await puter.fs.delete(path);
  } catch (e) {
    console.warn("Physical file could not be deleted or already removed.");
  }
};

const downloadFromCloud = async (path: string, fileName: string) => {
  try {
    const blob = await puter.fs.read(path);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    alert("Failed to read file. It might have been removed or the node is offline.");
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

const CloudImage = ({ path, className, alt }: { path: string, className?: string, alt?: string }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    if (!path) return;
    if (path.startsWith('http') || path.startsWith('data:')) {
      setSrc(path);
      return;
    }

    let isMounted = true;
    const loadImg = async () => {
      try {
        const blob = await puter.fs.read(path);
        if (isMounted) {
          setSrc(window.URL.createObjectURL(blob));
        }
      } catch (e) {
        console.error("Error loading image from cloud:", e);
      }
    };
    loadImg();
    return () => { isMounted = false; };
  }, [path]);

  return <img src={src || 'https://via.placeholder.com/800x450?text=Loading...'} className={className} alt={alt} />;
};

const LoginMenu = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const interval = setInterval(() => {
      const btnContainer = document.getElementById("google-login-btn-container");
      if (btnContainer && (window as any).google) {
        (window as any).google.accounts.id.renderButton(
          btnContainer,
          { theme: "filled_blue", size: "large", width: "240", shape: "pill", text: "continue_with" }
        );
        try {
          (window as any).google.accounts.id.prompt();
        } catch (e) {
          console.warn("Google One Tap prompt failed, falling back to button.");
        }
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[320px] bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-xl">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-black" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" /></svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-white italic uppercase">Excalibur Access</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Connect to download and publish</p>
          </div>
        </div>
        <div id="google-login-btn-container" className="flex justify-center min-h-[44px]" />
        <button onClick={onClose} className="w-full text-[10px] text-zinc-600 font-bold uppercase hover:text-white transition-colors tracking-widest">Close Window</button>
      </div>
    </div>
  );
};

const AssetRow: React.FC<{
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-xl p-3 flex items-center gap-3 cursor-pointer group w-full hover:bg-white/[0.03] border border-white/5">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <CloudImage path={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={asset.title} />
      {asset.reports.length > 0 && (
        <div className="absolute top-1 left-1 bg-red-600 text-white px-1 py-0.5 rounded text-[7px] font-black flex items-center gap-0.5 shadow-lg border border-red-500/50">
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
  
  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  // Initial Boot: Load from Cloud
  useEffect(() => {
    const boot = async () => {
      const storedLocalUser = localStorage.getItem('ex_cur_user');
      if (storedLocalUser) setCurrentUser(JSON.parse(storedLocalUser));

      const cloudData = await loadGlobalState();
      if (cloudData) {
        setUsers(cloudData.users || []);
        setAssets(cloudData.assets || []);
      }
      setIsCloudLoaded(true);
    };
    boot();
  }, []);

  // Sync to Cloud on Changes
  useEffect(() => {
    if (isCloudLoaded) {
      saveGlobalState(users, assets);
    }
  }, [users, assets, isCloudLoaded]);

  // Save current user locally for session persistence
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ex_cur_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ex_cur_user');
    }
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.username === ADMIN_EMAIL;
  }, [currentUser]);

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
        bio: "Cloud Member", 
        links: [] 
      };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
    }
    setShowLoginMenu(false);
  }, [users]);

  useEffect(() => {
    const initGoogle = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
          auto_select: false,
          use_fedcm_for_prompt: false,
        });
      }
    };

    if ((window as any).google) {
      initGoogle();
    } else {
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) { script.addEventListener('load', initGoogle); }
    }
  }, [handleGoogleSignIn]);

  const handleRename = (newName: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, name: newName };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    setAssets(prev => prev.map(a => a.userId === currentUser.id ? { ...a, authorName: newName } : a));
  };

  const handleDownload = async (asset: Asset) => {
    await downloadFromCloud(asset.fileData!, asset.title + asset.fileType);
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a));
  };

  const handlePublish = async (files: { thumb: File, rbx: File, data: any }) => {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      const rbxPath = await uploadToCloud(files.rbx, 'Binaries');
      const thumbPath = await uploadToCloud(files.thumb, 'Thumbnails');
      
      const newAsset: Asset = {
        id: 'a_' + Date.now(),
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: files.data.title,
        description: files.data.desc || "Excalibur Premium Asset.",
        category: files.data.category,
        thumbnailUrl: thumbPath,
        videoUrl: "",
        fileData: rbxPath, 
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
      alert("Sync Failed: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    if (asset.userId !== currentUser?.id && !isAdmin) return;
    
    if (confirm("Delete this asset permanently from the cloud?")) {
      if (asset.fileData) await deleteFromCloud(asset.fileData);
      if (asset.thumbnailUrl && !asset.thumbnailUrl.startsWith('http')) await deleteFromCloud(asset.thumbnailUrl);
      
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setSelectedAssetId(null);
    }
  };

  const handleReport = (assetId: string) => {
    if (!currentUser) {
      setShowLoginMenu(true);
      return;
    }
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        if (a.reports.includes(currentUser.id)) return a;
        return { ...a, reports: [...a.reports, currentUser.id] };
      }
      return a;
    }));
  };

  const handleAddComment = (assetId: string) => {
    if (!currentUser) {
      setShowLoginMenu(true);
      return;
    }
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: 'c_' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text: newComment,
      timestamp: Date.now()
    };

    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return { ...a, comments: [comment, ...a.comments] };
      }
      return a;
    }));
    setNewComment('');
  };

  const filteredAssets = useMemo(() => assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())), [assets, searchQuery]);
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
              <div className="text-center space-y-0.5">
                <h1 className="text-5xl font-black uppercase tracking-tighter animate-in slide-in-from-bottom duration-500 italic">Central</h1>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-ghost italic">Repository</h1>
              </div>
              <div className="relative max-w-xl mx-auto">
                <input type="text" placeholder="Search the Excalibur ecosystem..." className="w-full search-pill rounded-xl py-4 px-6 text-lg font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5 transition-all focus:border-white/10" onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="space-y-3.5 animate-in fade-in duration-700">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {filteredAssets.length === 0 && (
                   <div className="py-20 text-center space-y-4">
                      <p className="text-zinc-800 font-bold uppercase tracking-widest text-[10px] italic">No assets found in the cloud.</p>
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
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Cloud Files</h1>
                  <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-[0.4em] ml-1">Verified Node Sync</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-5 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:brightness-90 transition-all shadow-lg">Upload New Asset</button>}
              </div>
              <div className="space-y-3.5">
                {currentUser ? (
                  assets.filter(a => a.userId === currentUser.id).length > 0 ? (
                    assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)
                  ) : (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                      <p className="text-zinc-800 font-bold uppercase tracking-widest text-[9px]">You haven't published any assets yet.</p>
                    </div>
                  )
                ) : (
                  <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest mb-3.5">Log in to manage your cloud entries</p>
                    <button onClick={() => setShowLoginMenu(true)} className="bg-white text-black px-5 py-2 rounded-full font-bold text-[8px] uppercase tracking-widest">Login to Dashboard</button>
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
                    {currentUser?.id === targetUser.id ? (
                      <div className="space-y-1">
                        <label className="text-[7px] font-black uppercase text-blue-500 ml-1">Edit Cloud Identity</label>
                        <input 
                          className="bg-white/5 text-3xl font-black uppercase italic tracking-tighter leading-none border border-white/10 px-3 py-1 rounded-xl focus:outline-none w-full max-w-xs focus:border-blue-500/50"
                          value={targetUser.name}
                          onChange={(e) => handleRename(e.target.value)}
                        />
                      </div>
                    ) : (
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{targetUser.name}</h2>
                    )}
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Node ID: @{targetUser.username.split('@')[0]}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed font-medium max-w-sm">{targetUser.bio || "Active member of the Excalibur Cloud Repository."}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-lg font-bold uppercase italic tracking-tight border-b border-white/5 pb-3">Entries in Library</h3>
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
                    <CloudImage path={asset.thumbnailUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">{asset.title}</h2>
                      <div className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 text-[7px] font-black uppercase tracking-widest">CLOUD SYNCED</div>
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed font-medium">{asset.description}</p>
                  </div>
                  
                  {/* Comments */}
                  <div className="pt-8 border-t border-white/5 space-y-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600 italic">User Feedback ({asset.comments.length})</h4>
                    <div className="space-y-4">
                      {currentUser && (
                        <div className="flex gap-3">
                          <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                          <div className="flex-grow space-y-2">
                            <textarea 
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500/30 h-20 resize-none transition-all placeholder:text-zinc-800"
                              placeholder="Join the discussion..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                            />
                            <button 
                              onClick={() => handleAddComment(asset.id)}
                              className="bg-white text-black text-[8px] font-black uppercase px-4 py-2 rounded-lg tracking-widest hover:brightness-90 transition-all shadow-lg"
                            >Post Comment</button>
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
                        {asset.comments.length === 0 && <p className="text-[9px] text-zinc-700 font-bold uppercase text-center py-4">No community feedback yet.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-[300px] bg-[#0a0a0a] border-l border-white/5 p-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <span className="text-[8px] font-bold uppercase text-zinc-700 tracking-widest">Metadata</span>
                       <button onClick={() => setSelectedAssetId(null)} className="bg-white/5 p-1.5 rounded-full hover:bg-white/10 transition-all rotate-45 text-zinc-500"><Icons.Plus /></button>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => handleReport(asset.id)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all ${asset.reports.includes(currentUser?.id || '') ? 'bg-red-600/20 border-red-600/50 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-red-600/30 hover:text-red-400'}`}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z"/></svg>
                        Report ({asset.reports.length})
                      </button>

                      {(isOwner || isAdmin) && (
                        <button 
                          onClick={() => handleDelete(asset.id)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 border border-red-600/20 text-red-500 text-[9px] font-bold uppercase tracking-widest hover:bg-red-600/20 transition-all shadow-lg"
                        >
                          Remove Cloud Entry
                        </button>
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
                      <p className="text-[7px] text-zinc-700 uppercase font-black italic">Published: {new Date(asset.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:brightness-90 transition-all mt-6 shadow-2xl active:scale-95">SYNC & DOWNLOAD</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showLoginMenu && <LoginMenu onClose={() => setShowLoginMenu(false)} />}
      
      {showPublishModal && (
        <PublishModal 
          isUploading={isUploading} 
          onPublish={handlePublish} 
          onClose={() => setShowPublishModal(false)} 
        />
      )}
    </div>
  );
}

const PublishModal = ({ onClose, onPublish, isUploading }: { onClose: () => void, onPublish: (files: { thumb: File, rbx: File, data: any }) => void, isUploading: boolean }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState(Category.MODEL);
  const [thumb, setThumb] = useState<File | null>(null);
  const [rbxFile, setRbxFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumb || !rbxFile) return alert("Required binary and thumbnail data missing.");
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
              <h2 className="text-xl font-bold text-white tracking-tight uppercase italic">Syncing to Cloud...</h2>
              <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest italic">Encrypting repository node entry</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1">
                <h2 className="text-xl font-black uppercase italic text-white leading-none tracking-tight">Upload Asset</h2>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Global Excalibur Ecosystem</p>
              </div>
              <button onClick={onClose} className="p-1.5 text-zinc-700 hover:text-white transition-all bg-white/5 rounded-full rotate-45"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Asset Designation</label>
                <input required type="text" placeholder="e.g. Low Poly Engine V4" className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Technical Summary</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all h-24 resize-none placeholder:text-zinc-800" placeholder="Describe the components..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Binary Stream (.rbxm/.rbxl)</label>
                <label className={`w-full p-5 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-600 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <Icons.Script />
                  <span className="font-bold text-[10px] tracking-widest mt-2 uppercase">{rbxFile ? rbxFile.name : "Link Binary"}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Thumbnail</label>
                  <label className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider ml-1">Category</label>
                  <select className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none text-center font-bold text-[10px] cursor-pointer hover:bg-white/[0.07] transition-all uppercase italic" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:brightness-90 transition-all shadow-2xl active:scale-95">CONFIRM ENTRY</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
