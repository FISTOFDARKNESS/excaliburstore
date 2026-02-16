
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, Comment } from './types';
import { Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';
import { neonDb } from './services/neonService';

const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";

declare const puter: any;

const safeGetPublicUrl = async (path: string): Promise<string> => {
  try {
    if (puter?.fs && typeof puter.fs.get_public_url === 'function') return await puter.fs.get_public_url(path);
    if (puter?.fs && typeof puter.fs.getPublicUrl === 'function') return await puter.fs.getPublicUrl(path);
    if (puter?.fs && typeof puter.fs.share === 'function') {
      const shared = await puter.fs.share(path);
      return typeof shared === 'string' ? shared : shared.url;
    }
    throw new Error("SDK Error");
  } catch (e) {
    try {
      const blob = await puter.fs.read(path);
      return URL.createObjectURL(blob);
    } catch (innerE) {
      return "";
    }
  }
};

const uploadAndGetPublicUrl = async (file: File, folder: string = 'PublicAssets'): Promise<string> => {
  const dir = `Documents/ExcaliburStore/${folder}`;
  try { await puter.fs.mkdir(dir, { recursive: true }); } catch (e) {}
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
  } catch (e) { 
    console.error("JWT Parse Error:", e);
    return null; 
  }
};

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
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const refreshData = async () => {
    setIsSyncing(true);
    try {
      const [assetRes, userRes] = await Promise.all([
        neonDb.getAllAssets(),
        neonDb.getAllUsers()
      ]);
      // Se houver erro ou retornar nulo, o catch abaixo preservará os dados atuais.
      setAssets(assetRes || []);
      setUsers(userRes || []);
      setIsCloudLoaded(true);
    } catch (e) {
      console.error("Sync error - Mantendo dados locais:", e);
      // NÃO limpamos as arrays aqui. Se falhar, os assets antigos continuam na tela.
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleSignIn = useCallback(async (response: any) => {
    setIsAuthenticating(true);
    try {
      const payload = parseJwt(response.credential);
      if (!payload) {
        setIsAuthenticating(false);
        return;
      }
      
      const loggedUser: User = { 
        id: payload.sub, 
        name: payload.name || "Unknown User", 
        username: payload.email || "", 
        avatar: payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || "U")}&background=random`, 
        provider: 'google', 
        followers: [], 
        following: [], 
        bio: "Excalibur Contributor"
      };

      setCurrentUser(loggedUser);
      setShowLoginMenu(false);
      
      localStorage.setItem('ex_store_session_v1', JSON.stringify(loggedUser));

      await neonDb.saveUser(loggedUser);
      setIsAuthenticating(false);
      refreshData();
    } catch (err) {
      console.error("Login Error:", err);
      setIsAuthenticating(false);
    }
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('ex_store_session_v1');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed && parsed.id) setCurrentUser(parsed);
      } catch (e) {
        localStorage.removeItem('ex_store_session_v1');
      }
    }
    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initGSI = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
          ux_mode: "popup",
          auto_select: false
        });
      }
    };

    if ((window as any).google) {
      initGSI();
    } else {
      const script = document.querySelector('script[src*="gsi/client"]');
      script?.addEventListener('load', initGSI);
    }
  }, [handleGoogleSignIn]);

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

  const handleDownload = async (asset: Asset) => {
    try {
      await neonDb.incrementDownload(asset.id);
    } catch (e) {}
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: (a.downloadCount || 0) + 1 } : a));
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
        description: files.data.desc || "",
        category: files.data.category,
        thumbnailUrl: thumbUrl,
        fileData: rbxUrl, 
        fileType: files.rbx.name.substring(files.rbx.name.lastIndexOf('.')) as any,
        timestamp: Date.now(),
        downloadCount: 0,
        likes: [],
        dislikes: [],
        reports: [],
        comments: [],
        creditsRequired: false
      };

      await neonDb.saveAsset(newAsset);
      setShowPublishModal(false);
      refreshData();
    } catch (e: any) {
      alert("Falha no upload. Seus dados antigos estão seguros.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddComment = async (assetId: string) => {
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

    try {
      await neonDb.saveComment(comment, assetId);
      setNewComment('');
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, comments: [comment, ...(a.comments || [])] } : a));
    } catch (e) {
      alert("Falha ao postar comentário.");
    }
  };

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(a => {
      const title = (a.title || "").toLowerCase();
      const desc = (a.description || "").toLowerCase();
      const basic = title.includes(q) || desc.includes(q);
      const semantic = searchKeywords.some(kw => title.includes(kw.toLowerCase()));
      return basic || semantic;
    });
  }, [assets, searchQuery, searchKeywords]);

  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white font-sans selection:bg-blue-500/30">
      <aside className="w-64 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-8 z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-14 cursor-pointer group" onClick={() => { setActiveTab('home'); setViewingUserId(null); }}>
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl shadow-white/5"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-xl italic">EXCALIBUR</span>
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
                <img src={currentUser.avatar} className="w-9 h-9 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                <span className="text-[11px] font-bold truncate">@{currentUser.name.split(' ')[0]}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); localStorage.removeItem('ex_store_session_v1'); }} className="w-full text-[10px] font-black uppercase text-red-500/60 hover:text-red-500 text-left">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl text-[11px] tracking-widest active:scale-95">Sign In</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-64 min-h-screen relative overflow-x-hidden">
        {activeTab === 'home' && (
          <div className="px-16 pt-28 pb-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-20">
              <div className="text-center relative">
                <h1 className="text-7xl font-black uppercase tracking-tighter italic">EXCALIBUR</h1>
                <h1 className="text-7xl font-black uppercase tracking-tighter text-ghost italic">REPOSITORY</h1>
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
                   {isSyncing ? (
                     <span className="text-[9px] font-black tracking-[0.3em] text-blue-500 uppercase animate-pulse">Synchronizing Cloud...</span>
                   ) : (
                     <span className="text-[9px] font-black tracking-[0.6em] text-zinc-800 uppercase">Decentralized Archive</span>
                   )}
                </div>
              </div>

              <div className="relative max-w-2xl mx-auto">
                <input type="text" placeholder="Scan the network..." className="w-full search-pill rounded-[2rem] py-6 px-10 text-2xl font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>

              <div className="space-y-5 pb-32">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {!isCloudLoaded && !isSyncing && <div className="py-20 text-center animate-spin flex justify-center text-zinc-800"><Icons.Plus /></div>}
                {isCloudLoaded && filteredAssets.length === 0 && (
                   <div className="py-20 text-center text-zinc-800 uppercase font-black text-[11px] tracking-widest">No entries found in archive.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="px-16 pt-28 pb-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-16">
                <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">Marketplace</h1>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest">Broadcast File</button>}
              </div>
              <div className="space-y-5">
                {assets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-16 pt-28 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-20 pb-40">
              <div className="premium-card rounded-[3rem] p-12 border border-white/5 relative overflow-hidden group">
                <div className="flex flex-col sm:flex-row items-center gap-12 relative z-10">
                  <img src={targetUser.avatar} className="w-32 h-32 rounded-[2rem] border-4 border-white/5 shadow-2xl object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-grow text-center sm:text-left space-y-4">
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{targetUser.name}</h2>
                    <p className="text-zinc-500 text-lg leading-relaxed font-medium">{targetUser.bio || "Active contributor to Excalibur Store."}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-10">
                <h3 className="text-2xl font-black uppercase italic tracking-tight opacity-20">Contributions</h3>
                <div className="space-y-5">
                  {assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            return (
              <div className="relative w-full max-w-6xl bg-[#080808] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]">
                <div className="flex-grow p-10 overflow-y-auto custom-scrollbar space-y-12">
                  <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden border border-white/5 bg-zinc-900">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover" alt={asset.title} />
                  </div>
                  <div className="space-y-5">
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter">{asset.title}</h2>
                    <p className="text-zinc-500 text-lg leading-relaxed font-medium">{asset.description}</p>
                  </div>
                  <div className="pt-12 border-t border-white/5 space-y-10">
                    <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-zinc-800 italic">Discussion</h4>
                    <div className="space-y-8">
                      {currentUser && (
                        <div className="flex gap-5">
                          <img src={currentUser.avatar} className="w-12 h-12 rounded-2xl border border-white/10" referrerPolicy="no-referrer" />
                          <div className="flex-grow space-y-4">
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-base text-white focus:outline-none focus:border-blue-500/30 h-28 resize-none" placeholder="Add to the conversation..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                            <button onClick={() => handleAddComment(asset.id)} className="bg-white text-black text-[10px] font-black uppercase px-8 py-3 rounded-xl">Post</button>
                          </div>
                        </div>
                      )}
                      {(asset.comments || []).map(c => (
                        <div key={c.id} className="flex gap-5">
                          <img src={c.userAvatar} className="w-10 h-10 rounded-xl border border-white/5" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-[11px] font-black uppercase text-white mb-1">{c.userName}</p>
                            <p className="text-sm text-zinc-500">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-[360px] bg-[#0a0a0a] border-l border-white/5 p-10 flex flex-col justify-between">
                  <div className="space-y-10">
                    <span className="text-[10px] font-black uppercase text-zinc-800 tracking-[0.4em]">Asset Parameters</span>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-center">
                        <p className="text-3xl font-black italic">{asset.downloadCount || 0}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-800 mt-2">Transmissions</p>
                      </div>
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-center">
                        <p className="text-sm font-black text-blue-500 uppercase">{asset.fileType}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-800 mt-2">Class</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-6 rounded-[2rem] text-[12px] tracking-[0.3em] active:scale-95">RETRIEVE ASSET</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showLoginMenu && <LoginMenu isAuthenticating={isAuthenticating} onClose={() => setShowLoginMenu(false)} />}
      {showPublishModal && <PublishModal isUploading={isUploading} onPublish={handlePublish} onClose={() => setShowPublishModal(false)} />}
    </div>
  );
}

const LoginMenu = ({ onClose, isAuthenticating }: { onClose: () => void, isAuthenticating: boolean }) => {
  useEffect(() => {
    let attempts = 0;
    const renderBtn = () => {
      const el = document.getElementById("google-signin-btn");
      if (el && (window as any).google) {
        try {
          (window as any).google.accounts.id.renderButton(el, { 
            theme: "outline", 
            size: "large", 
            width: "320",
            shape: "pill" 
          });
        } catch (e) {
          console.error("GSI Error:", e);
        }
      } else if (attempts < 10) {
        attempts++;
        setTimeout(renderBtn, 500);
      }
    };
    renderBtn();
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative w-full max-sm:mx-4 max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 shadow-2xl text-center">
        {isAuthenticating ? (
          <div className="py-10 flex flex-col items-center gap-6">
            <div className="w-12 h-12 border-4 border-t-white border-white/10 rounded-full animate-spin" />
            <h2 className="text-xl font-black uppercase italic animate-pulse">Syncing...</h2>
          </div>
        ) : (
          <>
            <h2 className="text-4xl font-black uppercase italic mb-10">Identity Sync</h2>
            <div className="flex justify-center mb-10 min-h-[44px]">
               <div id="google-signin-btn" />
            </div>
            <p className="text-[10px] text-zinc-800 uppercase font-black tracking-widest px-4">Utilize sua conta Google para sincronizar seu perfil.</p>
          </>
        )}
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
    if (!thumb || !rbxFile) return alert("Arquivos obrigatórios.");
    onPublish({ thumb, rbx: rbxFile, data: { title, desc, category } });
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {isUploading ? (
          <div className="py-28 text-center">
            <div className="w-20 h-20 border-4 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="mt-6 font-black italic">Broadcasting to Cloud...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-10">
            <h2 className="text-3xl font-black uppercase italic">Upload Entry</h2>
            <input required type="text" placeholder="Asset Label" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5" value={title} onChange={e => setTitle(e.target.value)} />
            <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 h-32" placeholder="Technical Spec" value={desc} onChange={e => setDesc(e.target.value)} />
            <label className="w-full p-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center cursor-pointer hover:border-white/20 transition-all">
              <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
              <span className="font-black italic text-zinc-500">{rbxFile ? rbxFile.name : "Select Binary (.rbxm/.rbxl)"}</span>
            </label>
            <div className="grid grid-cols-2 gap-8">
              <label className="h-32 border-2 border-dashed rounded-[2rem] flex items-center justify-center cursor-pointer overflow-hidden hover:border-white/20 transition-all">
                <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <span className="font-black text-zinc-500">Thumb</span>}
              </label>
              <select className="bg-white/5 border border-white/10 rounded-[2rem] p-6 font-black uppercase" value={category} onChange={e => setCategory(e.target.value as Category)}>
                {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-white text-black font-black uppercase py-6 rounded-[2rem] active:scale-95 transition-all">Broadcast</button>
          </form>
        )}
      </div>
    </div>
  );
};
