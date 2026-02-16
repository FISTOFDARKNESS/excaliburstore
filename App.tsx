
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, VerificationData, Comment } from './types';
import { Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const ADMIN_EMAIL = "kaioadrik08@gmail.com";
const REGISTRY_KV_KEY = 'excalibur_global_v6_shared'; 

declare const puter: any;

// --- Puter API Helpers ---

/**
 * Resilient helper to get a public URL. 
 * Fixes "is not a function" by checking all possible v2 SDK method names.
 */
const safeGetPublicUrl = async (path: string): Promise<string> => {
  try {
    // Attempt standard snake_case (most common in current v2)
    if (puter?.fs && typeof puter.fs.get_public_url === 'function') {
      return await puter.fs.get_public_url(path);
    } 
    // Attempt camelCase variation
    if (puter?.fs && typeof puter.fs.getPublicUrl === 'function') {
      return await puter.fs.getPublicUrl(path);
    }
    // Attempt share as a robust fallback
    if (puter?.fs && typeof puter.fs.share === 'function') {
      const shared = await puter.fs.share(path);
      return typeof shared === 'string' ? shared : shared.url;
    }
    // Final fallback: use the Puter CDN structure directly if we know the path
    // Note: This is a last resort and may require specific bucket permissions.
    throw new Error("Puter SDK is not fully initialized or method missing.");
  } catch (e) {
    console.error("Cloud Error generating Public URL:", e);
    // Even if it fails, we return a standard blob URL for the current user's session
    const blob = await puter.fs.read(path);
    return URL.createObjectURL(blob);
  }
};

/**
 * Global State: Key-Value store shared by all users of the app.
 */
const saveGlobalState = async (users: User[], assets: Asset[]) => {
  try {
    const data = JSON.stringify({ users, assets });
    await puter.kv.set(REGISTRY_KV_KEY, data);
  } catch (e) {
    console.error("KV Sync Error:", e);
  }
};

const loadGlobalState = async (): Promise<{ users: User[], assets: Asset[] } | null> => {
  try {
    const data = await puter.kv.get(REGISTRY_KV_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("KV Load Error:", e);
    return null;
  }
};

const uploadAndGetPublicUrl = async (file: File, folder: string = 'PublicAssets'): Promise<string> => {
  const dir = `Documents/ExcaliburStore/${folder}`;
  try {
    await puter.fs.mkdir(dir, { recursive: true });
  } catch (e) {}

  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const path = `${dir}/${fileName}`;
  
  await puter.fs.write(path, file);
  return await safeGetPublicUrl(path);
};

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) { return null; }
};

// --- UI Components ---

const AssetRow: React.FC<{
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-2xl p-4 flex items-center gap-5 cursor-pointer group w-full border border-white/5 transition-all">
    <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 shadow-inner">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={asset.title} loading="lazy" />
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-lg text-white truncate group-hover:text-blue-400 transition-colors uppercase italic tracking-tight">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-1">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[11px] font-bold text-zinc-500 hover:text-white transition-colors">
          @{asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-1.5 text-zinc-600">
         <span className="text-[11px] font-bold">{asset.downloadCount}</span>
         <Icons.Download />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white text-black px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-90 transition-all shadow-xl active:scale-95">
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

  // Initial Data Fetch: Runs for everyone (guests and users)
  useEffect(() => {
    const initialize = async () => {
      // 1. Recover local session
      const stored = localStorage.getItem('ex_store_session_v1');
      if (stored) setCurrentUser(JSON.parse(stored));

      // 2. Load the Global Registry (Everyone sees this)
      const cloudData = await loadGlobalState();
      if (cloudData) {
        setUsers(cloudData.users || []);
        setAssets(cloudData.assets || []);
      }
      setIsCloudLoaded(true);
    };
    initialize();

    // Polling Sync: Refresh the list from the cloud every 15 seconds
    const syncInterval = setInterval(async () => {
      setIsSyncing(true);
      const latest = await loadGlobalState();
      if (latest) {
        setUsers(latest.users || []);
        setAssets(latest.assets || []);
      }
      setTimeout(() => setIsSyncing(false), 500);
    }, 15000);

    return () => clearInterval(syncInterval);
  }, []);

  // Sync keywords with Gemini
  useEffect(() => {
    const fetchKeywords = async () => {
      if (searchQuery.trim().length >= 2) {
        const keywords = await getSearchKeywords(searchQuery);
        setSearchKeywords(keywords);
      } else {
        setSearchKeywords([]);
      }
    };
    const delay = setTimeout(fetchKeywords, 600);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleGoogleSignIn = useCallback((response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    let loggedUser: User;
    if (existing) {
      loggedUser = existing;
    } else {
      loggedUser = { 
        id: payload.sub, 
        name: payload.name, 
        username: payload.email, 
        avatar: payload.picture, 
        provider: 'google', 
        followers: [], 
        following: [], 
        bio: "Excalibur Store Contributor", 
        links: [] 
      };
      setUsers(prev => [...prev, loggedUser]);
    }
    setCurrentUser(loggedUser);
    localStorage.setItem('ex_store_session_v1', JSON.stringify(loggedUser));
    setShowLoginMenu(false);
  }, [users]);

  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
      });
    }
  }, [handleGoogleSignIn]);

  const handleDownload = (asset: Asset) => {
    setAssets(prev => {
      const updated = prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a);
      saveGlobalState(users, updated);
      return updated;
    });
    window.open(asset.fileData, '_blank');
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

      setAssets(prev => {
        const updated = [newAsset, ...prev];
        saveGlobalState(users, updated);
        return updated;
      });
      setShowPublishModal(false);
    } catch (e: any) {
      alert("Cloud Sync Failure: Make sure you have a Puter account active.");
      console.error(e);
    } finally {
      setIsUploading(false);
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

    setAssets(prev => {
      const updated = prev.map(a => a.id === assetId ? { ...a, comments: [comment, ...a.comments] } : a);
      saveGlobalState(users, updated);
      return updated;
    });
    setNewComment('');
  };

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(a => {
      const basic = a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      const semantic = searchKeywords.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()));
      return basic || semantic;
    });
  }, [assets, searchQuery, searchKeywords]);

  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white font-sans selection:bg-blue-500/30">
      {/* Permanent Sidebar */}
      <aside className="w-64 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-8 z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-14 cursor-pointer group" onClick={() => { setActiveTab('home'); setViewingUserId(null); }}>
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl shadow-white/5"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-xl italic italic-shadow">EXCALIBUR</span>
        </div>
        
        <nav className="flex-grow space-y-3">
          {['home', 'vault', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-5 px-5 py-4 text-[12px] font-black tracking-widest uppercase transition-all rounded-2xl ${activeTab === tab ? 'bg-white text-black shadow-2xl shadow-white/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'vault' ? <Icons.Script /> : <Icons.Plus />}
              {tab === 'vault' ? 'MARKET' : tab === 'home' ? 'EXPLORE' : 'PROFILE'}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <img src={currentUser.avatar} className="w-9 h-9 rounded-full border border-white/10 shadow-sm" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white">@{currentUser.name.split(' ')[0]}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Authenticated</span>
                </div>
              </div>
              <button onClick={() => { setCurrentUser(null); localStorage.removeItem('ex_store_session_v1'); }} className="w-full text-[10px] font-black uppercase text-red-500/60 hover:text-red-500 transition-colors text-left">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl text-[11px] tracking-widest hover:brightness-90 transition-all shadow-2xl active:scale-95">Sign In</button>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-grow ml-64 min-h-screen relative overflow-x-hidden">
        {activeTab === 'home' && (
          <div className="px-16 pt-28 pb-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-20">
              <div className="text-center relative">
                <h1 className="text-7xl font-black uppercase tracking-tighter italic animate-in slide-in-from-bottom duration-1000">EXCALIBUR</h1>
                <h1 className="text-7xl font-black uppercase tracking-tighter text-ghost italic">REPOSITORY</h1>
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
                   {isSyncing ? (
                     <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full animate-pulse">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-[9px] font-black tracking-[0.3em] text-blue-500 uppercase">Updating Global Nodes...</span>
                     </div>
                   ) : (
                     <span className="text-[9px] font-black tracking-[0.6em] text-zinc-800 uppercase animate-pulse-soft">Decentralized Cloud Active</span>
                   )}
                </div>
              </div>

              <div className="relative max-w-2xl mx-auto group">
                <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full group-focus-within:bg-blue-500/10 transition-all duration-700"></div>
                <input type="text" placeholder="Scan the network registry..." className="w-full search-pill rounded-[2rem] py-6 px-10 text-2xl font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5 transition-all focus:border-white/10 relative z-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>

              <div className="space-y-5 pb-32 animate-in fade-in duration-1000">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {filteredAssets.length === 0 && (
                   <div className="py-32 text-center space-y-6">
                      <p className="text-zinc-800 font-black uppercase tracking-[0.4em] text-[13px] italic">No data records found in the current sector.</p>
                      {!isCloudLoaded && <div className="w-8 h-8 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto shadow-2xl shadow-blue-500/20" />}
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="px-16 pt-28 pb-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-16">
                <div className="space-y-1">
                  <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">Marketplace</h1>
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.6em] ml-1">Universal Asset Exchange</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:brightness-90 transition-all shadow-2xl active:scale-95">Broadcast File</button>}
              </div>
              <div className="space-y-5">
                {/* Vault shows all assets in the market view */}
                {assets.length > 0 ? (
                  assets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)
                ) : (
                  <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                    <p className="text-zinc-800 font-black uppercase tracking-widest text-[11px]">The market is currently empty. Start the cycle.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-16 pt-28 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-20 pb-40">
              <div className="premium-card rounded-[3rem] p-12 border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 blur-[120px] -mr-40 -mt-40 transition-all group-hover:bg-blue-500/10"></div>
                <div className="flex flex-col sm:flex-row items-center gap-12 relative z-10">
                  <img src={targetUser.avatar} className="w-32 h-32 rounded-[2rem] border-4 border-white/5 shadow-2xl object-cover transition-transform group-hover:scale-105 duration-500" />
                  <div className="flex-grow text-center sm:text-left space-y-4">
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{targetUser.name}</h2>
                    <p className="text-blue-500/60 text-[12px] font-black uppercase tracking-widest">Repository Node Identity</p>
                    <p className="text-zinc-500 text-lg leading-relaxed font-medium max-w-md">{targetUser.bio || "Active member of the Excalibur decentralized storage ecosystem."}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-10">
                <h3 className="text-2xl font-black uppercase italic tracking-tight border-b border-white/5 pb-5 opacity-20">Transmission History</h3>
                <div className="space-y-5">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Detail Overlay */}
      {selectedAssetId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            return (
              <div className="relative w-full max-w-6xl bg-[#080808] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-in zoom-in-95 duration-500">
                <div className="flex-grow p-10 overflow-y-auto custom-scrollbar space-y-12">
                  <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-zinc-900 group">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-1000" />
                  </div>
                  <div className="space-y-5">
                    <div className="flex items-center gap-5">
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">{asset.title}</h2>
                      <span className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-full border border-blue-500/20 text-[9px] font-black uppercase tracking-widest">Network Record</span>
                    </div>
                    <p className="text-zinc-500 text-lg leading-relaxed font-medium">{asset.description}</p>
                  </div>
                  
                  <div className="pt-12 border-t border-white/5 space-y-10">
                    <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-zinc-800 italic">Technical Logs ({asset.comments.length})</h4>
                    <div className="space-y-8">
                      {currentUser && (
                        <div className="flex gap-5">
                          <img src={currentUser.avatar} className="w-12 h-12 rounded-2xl border border-white/10" />
                          <div className="flex-grow space-y-4">
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-base text-white focus:outline-none focus:border-blue-500/30 h-28 resize-none transition-all placeholder:text-zinc-900 font-medium" placeholder="Contribute your analysis..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                            <button onClick={() => handleAddComment(asset.id)} className="bg-white text-black text-[10px] font-black uppercase px-8 py-3 rounded-xl tracking-widest hover:brightness-90 transition-all shadow-2xl">Broadcast Log</button>
                          </div>
                        </div>
                      )}
                      {asset.comments.map(c => (
                        <div key={c.id} className="flex gap-5 animate-in slide-in-from-left-6">
                          <img src={c.userAvatar} className="w-12 h-12 rounded-2xl border border-white/5" />
                          <div className="flex-grow space-y-1.5">
                            <div className="flex items-center gap-4">
                              <span className="text-[11px] font-black text-white uppercase italic">{c.userName}</span>
                              <span className="text-[9px] text-zinc-800 font-bold uppercase">{new Date(c.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-base text-zinc-500 leading-relaxed font-medium">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-[360px] bg-[#0a0a0a] border-l border-white/5 p-10 flex flex-col justify-between">
                  <div className="space-y-10">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-zinc-800 tracking-[0.4em]">Asset Parameters</span>
                       <button onClick={() => setSelectedAssetId(null)} className="text-zinc-700 hover:text-white transition-colors rotate-45 scale-125"><Icons.Plus /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-center shadow-inner">
                        <p className="text-3xl font-black italic tracking-tighter">{asset.downloadCount}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-800 mt-2">Transmissions</p>
                      </div>
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-center shadow-inner">
                        <p className="text-sm font-black text-blue-500 uppercase tracking-widest">{asset.fileType.substring(1)}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-800 mt-2">Type-Class</p>
                      </div>
                    </div>

                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl cursor-pointer hover:bg-white/[0.04] transition-all group/author" onClick={() => { setViewingUserId(asset.userId); setActiveTab('profile'); setSelectedAssetId(null); }}>
                       <div className="flex items-center gap-3 mb-3">
                          <img src={asset.authorAvatar} className="w-7 h-7 rounded-lg border border-white/10" />
                          <span className="text-[10px] font-black uppercase text-zinc-400 group-hover/author:text-white transition-colors">@{asset.authorName}</span>
                       </div>
                       <p className="text-[9px] text-zinc-800 uppercase font-black italic tracking-[0.2em]">Node Creation: {new Date(asset.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-6 rounded-[2rem] text-[12px] tracking-[0.3em] hover:brightness-90 transition-all shadow-2xl active:scale-95">RETRIEVE ASSET</button>
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
        { theme: "outline", size: "large", width: "100%", shape: "pill" }
      );
    }
  }, []);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-4 mb-14">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Identity Sync</h2>
          <p className="text-[11px] text-zinc-700 font-black uppercase tracking-[0.4em] italic">Access Excalibur Infrastructure</p>
        </div>
        <div id="google-signin-btn" className="w-full mb-10 flex justify-center" />
        <p className="text-[10px] text-zinc-800 text-center font-black uppercase tracking-widest leading-relaxed">
          Verify your credentials to enable global broadcasting and management nodes.
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
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-12 duration-700">
        {isUploading ? (
          <div className="py-28 flex flex-col items-center justify-center space-y-10 text-center">
            <div className="w-20 h-20 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin shadow-2xl shadow-blue-500/20" />
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Broadcasting...</h2>
              <p className="text-zinc-700 text-[11px] font-black uppercase tracking-[0.5em] italic">Uploading to distributed cloud nodes</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-12">
              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">Upload Entry</h2>
                <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest italic">Encrypted Transmission</p>
              </div>
              <button onClick={onClose} className="p-3 text-zinc-800 hover:text-white transition-all bg-white/5 rounded-full rotate-45 scale-110"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-zinc-700 tracking-widest ml-1">Asset Label</label>
                <input required type="text" placeholder="e.g. Advanced Combat Kernel" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-base focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-900 font-bold" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-zinc-700 tracking-widest ml-1">Technical Spec</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-base focus:outline-none focus:border-blue-500/50 transition-all h-32 resize-none placeholder:text-zinc-900 font-medium" placeholder="Describe functionality..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-zinc-700 tracking-widest ml-1">Binary Payload (.rbxm/.rbxl)</label>
                <label className={`w-full p-8 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'bg-white/5 border-white/10 text-zinc-700 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <div className="scale-125"><Icons.Script /></div>
                  <span className="font-black text-[12px] tracking-widest mt-4 uppercase italic">{rbxFile ? rbxFile.name : "Select Binary"}</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-zinc-700 tracking-widest ml-1">Cover Art</label>
                  <label className={`w-full h-32 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-zinc-700 tracking-widest ml-1">Class</label>
                  <select className="w-full h-32 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white appearance-none text-center font-black text-[12px] uppercase italic tracking-widest" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black font-black uppercase py-6 rounded-[2rem] text-[12px] tracking-[0.4em] hover:brightness-90 transition-all shadow-2xl active:scale-95">CONFIRM GLOBAL BROADCAST</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
