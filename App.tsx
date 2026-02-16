
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, VerificationData, Comment } from './types';
import { Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- CONFIGURAÇÃO ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const ADMIN_EMAIL = "kaioadrik08@gmail.com";
const REGISTRY_KV_KEY = 'excalibur_global_registry_final_v1';

declare const puter: any;

// --- Helpers de API Puter ---

/**
 * Tenta obter uma URL pública de várias formas para evitar erro de "not a function"
 */
const safeGetPublicUrl = async (path: string): Promise<string> => {
  try {
    // Tenta snake_case (comum no v2)
    if (typeof puter.fs.get_public_url === 'function') {
      return await puter.fs.get_public_url(path);
    } 
    // Tenta camelCase
    else if (typeof puter.fs.getPublicUrl === 'function') {
      return await puter.fs.getPublicUrl(path);
    }
    // Tenta share como fallback
    else if (typeof puter.fs.share === 'function') {
      const shared = await puter.fs.share(path);
      return typeof shared === 'string' ? shared : shared.url;
    }
    throw new Error("Método de URL pública não encontrado no Puter SDK.");
  } catch (e) {
    console.error("Erro ao gerar URL pública para:", path, e);
    // Fallback: Lê o arquivo e cria uma URL temporária (só funciona na sessão atual)
    const blob = await puter.fs.read(path);
    return URL.createObjectURL(blob);
  }
};

/**
 * Salva o estado global no KV do Puter (compartilhado entre usuários do app)
 */
const saveGlobalState = async (users: User[], assets: Asset[]) => {
  try {
    const data = JSON.stringify({ users, assets });
    await puter.kv.set(REGISTRY_KV_KEY, data);
  } catch (e) {
    console.error("Erro ao sincronizar KV global:", e);
  }
};

/**
 * Carrega o estado global do KV do Puter
 */
const loadGlobalState = async (): Promise<{ users: User[], assets: Asset[] } | null> => {
  try {
    const data = await puter.kv.get(REGISTRY_KV_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Erro ao carregar KV global:", e);
    return null;
  }
};

const uploadAndGetPublicUrl = async (file: File, folder: string = 'PublicAssets'): Promise<string> => {
  const dir = `Documents/ExcaliburCloud/${folder}`;
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

// --- Componentes ---

const AssetRow: React.FC<{
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-xl p-3 flex items-center gap-4 cursor-pointer group w-full hover:bg-white/[0.04] border border-white/5 transition-all">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={asset.title} loading="lazy" />
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-base text-white truncate group-hover:text-blue-400 transition-colors uppercase italic tracking-tight">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
          @{asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5 text-zinc-600">
         <span className="text-[10px] font-bold">{asset.downloadCount}</span>
         <Icons.Download />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white text-black px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-90 transition-all shadow-lg active:scale-95">
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

  // Boot Inicial: Carrega dados globais mesmo deslogado
  useEffect(() => {
    const boot = async () => {
      // Tenta recuperar sessão local
      const storedLocalUser = localStorage.getItem('ex_session_v1');
      if (storedLocalUser) setCurrentUser(JSON.parse(storedLocalUser));

      // Carrega dados globais do Puter KV
      const cloudData = await loadGlobalState();
      if (cloudData) {
        setUsers(cloudData.users || []);
        setAssets(cloudData.assets || []);
      }
      setIsCloudLoaded(true);
    };
    boot();

    // Polling: Atualiza a cada 20 segundos para ver posts de outros dispositivos
    const interval = setInterval(async () => {
      setIsSyncing(true);
      const latest = await loadGlobalState();
      if (latest) {
        setUsers(latest.users || []);
        setAssets(latest.assets || []);
      }
      setTimeout(() => setIsSyncing(false), 800);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // Sincroniza para o KV quando houver mudanças locais (apenas se logado para evitar sobrescrever com vazio no boot)
  useEffect(() => {
    if (isCloudLoaded && currentUser) {
      saveGlobalState(users, assets);
    }
  }, [users, assets, isCloudLoaded, currentUser]);

  // Busca Semântica Gemini
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
        bio: "Excalibur Repository Member", 
        links: [] 
      };
      setUsers(prev => [...prev, loggedUser]);
    }
    setCurrentUser(loggedUser);
    localStorage.setItem('ex_session_v1', JSON.stringify(loggedUser));
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
      if (currentUser) saveGlobalState(users, updated);
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
        description: files.data.desc || "Premium Repository Asset.",
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
      alert("Falha no Cloud Sync: " + e.message);
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
      const basicMatch = a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      const semanticMatch = searchKeywords.some(kw => a.title.toLowerCase().includes(kw.toLowerCase()));
      return basicMatch || semanticMatch;
    });
  }, [assets, searchQuery, searchKeywords]);

  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white font-sans selection:bg-blue-500/30">
      {/* Sidebar Fixo */}
      <aside className="w-64 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-6 z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-12 cursor-pointer group" onClick={() => { setActiveTab('home'); setViewingUserId(null); }}>
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center transition-all group-hover:scale-110 shadow-xl shadow-white/5"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-lg italic italic-shadow">EXCALIBUR</span>
        </div>
        
        <nav className="flex-grow space-y-2">
          {['home', 'vault', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-4 px-4 py-3 text-[11px] font-black tracking-[0.2em] uppercase transition-all rounded-xl ${activeTab === tab ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'vault' ? <Icons.Script /> : <Icons.Plus />}
              {tab === 'vault' ? 'REPOSITORY' : tab === 'home' ? 'EXPLORE' : 'PROFILE'}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          {currentUser ? (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-white/10 shadow-sm" />
                <span className="text-[10px] font-bold truncate opacity-60">@{currentUser.name.split(' ')[0]}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); localStorage.removeItem('ex_session_v1'); }} className="w-full text-[9px] font-black uppercase text-red-500/60 hover:text-red-500 transition-colors text-left">Logout Session</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-4 rounded-xl text-[10px] tracking-widest hover:brightness-90 transition-all shadow-xl active:scale-95">Sign In / Join</button>
          )}
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-grow ml-64 min-h-screen relative overflow-x-hidden bg-dot-pattern">
        {activeTab === 'home' && (
          <div className="px-12 pt-24 pb-20 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-16">
              <div className="text-center relative">
                <h1 className="text-6xl font-black uppercase tracking-tighter italic animate-in slide-in-from-bottom duration-700">CENTRAL</h1>
                <h1 className="text-6xl font-black uppercase tracking-tighter text-ghost italic">REPOSITORY</h1>
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
                   {isSyncing ? (
                     <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full animate-pulse">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className="text-[8px] font-black tracking-widest text-blue-500 uppercase">Syncing Node...</span>
                     </div>
                   ) : (
                     <span className="text-[8px] font-black tracking-[0.5em] text-zinc-800 uppercase">Encrypted Cloud Network</span>
                   )}
                </div>
              </div>

              <div className="relative max-w-2xl mx-auto group">
                <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full group-focus-within:bg-blue-500/10 transition-all"></div>
                <input type="text" placeholder="Search the global ecosystem..." className="w-full search-pill rounded-2xl py-5 px-8 text-xl font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5 transition-all focus:border-white/10 relative z-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>

              <div className="space-y-4 pb-24 animate-in fade-in duration-1000">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {filteredAssets.length === 0 && (
                   <div className="py-24 text-center space-y-4">
                      <p className="text-zinc-800 font-black uppercase tracking-[0.3em] text-[11px] italic">Accessing decentralized storage...</p>
                      {!isCloudLoaded && <div className="w-6 h-6 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />}
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Demais Abas e Modais Seguem Lógica Semelhante */}
        {activeTab === 'vault' && (
          <div className="px-12 pt-24 pb-20 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-end mb-12">
                <div className="space-y-1">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">The Vault</h1>
                  <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.5em] ml-1">Your Personal Node</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-90 transition-all shadow-xl active:scale-95">Publish Entry</button>}
              </div>
              <div className="space-y-4">
                {currentUser ? (
                  assets.filter(a => a.userId === currentUser.id).length > 0 ? (
                    assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)
                  ) : (
                    <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                      <p className="text-zinc-800 font-black uppercase tracking-widest text-[10px]">Vault is currently offline. Broadcast your first file.</p>
                    </div>
                  )
                ) : (
                  <div className="py-24 text-center bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-zinc-600 font-black text-[10px] uppercase tracking-widest mb-6">Authenticate to access your private node</p>
                    <button onClick={() => setShowLoginMenu(true)} className="bg-white text-black px-6 py-2.5 rounded-full font-black text-[9px] uppercase tracking-widest shadow-lg">Sign In</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-12 pt-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-16 pb-32">
              <div className="premium-card rounded-[2.5rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32"></div>
                <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10">
                  <img src={targetUser.avatar} className="w-28 h-28 rounded-3xl border-4 border-white/5 shadow-2xl object-cover transition-transform group-hover:scale-105" />
                  <div className="flex-grow text-center sm:text-left space-y-3">
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{targetUser.name}</h2>
                    <p className="text-blue-500/60 text-[11px] font-black uppercase tracking-widest">Verified Contributor</p>
                    <p className="text-zinc-500 text-sm leading-relaxed font-medium max-w-sm">{targetUser.bio || "Member of the Excalibur Global Ecosystem."}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <h3 className="text-xl font-black uppercase italic tracking-tight border-b border-white/5 pb-4 opacity-30">Library Nodes</h3>
                <div className="space-y-4">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modais (Login, Publish, Details) */}
      {selectedAssetId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            return (
              <div className="relative w-full max-w-5xl bg-[#080808] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-in zoom-in-95 duration-300">
                <div className="flex-grow p-8 overflow-y-auto custom-scrollbar space-y-10">
                  <div className="aspect-video w-full rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-zinc-900 group">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter">{asset.title}</h2>
                      <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full border border-blue-500/20 text-[8px] font-black uppercase tracking-widest">Global Entry</span>
                    </div>
                    <p className="text-zinc-500 text-base leading-relaxed font-medium">{asset.description}</p>
                  </div>
                  
                  <div className="pt-10 border-t border-white/5 space-y-8">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-700 italic">Network Logs ({asset.comments.length})</h4>
                    <div className="space-y-6">
                      {currentUser && (
                        <div className="flex gap-4">
                          <img src={currentUser.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                          <div className="flex-grow space-y-3">
                            <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-blue-500/30 h-24 resize-none transition-all placeholder:text-zinc-800" placeholder="Submit technical feedback..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                            <button onClick={() => handleAddComment(asset.id)} className="bg-white text-black text-[9px] font-black uppercase px-6 py-2.5 rounded-xl tracking-widest hover:brightness-90 transition-all shadow-xl">Post Log</button>
                          </div>
                        </div>
                      )}
                      {asset.comments.map(c => (
                        <div key={c.id} className="flex gap-4 animate-in slide-in-from-left-4">
                          <img src={c.userAvatar} className="w-10 h-10 rounded-full border border-white/5" />
                          <div className="flex-grow space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-white uppercase italic">{c.userName}</span>
                              <span className="text-[8px] text-zinc-700 font-bold uppercase">{new Date(c.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[12px] text-zinc-500 leading-relaxed font-medium">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-[320px] bg-[#0a0a0a] border-l border-white/5 p-8 flex flex-col justify-between">
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-black uppercase text-zinc-800 tracking-[0.3em]">Node Metadata</span>
                       <button onClick={() => setSelectedAssetId(null)} className="text-zinc-700 hover:text-white transition-colors rotate-45"><Icons.Plus /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                        <p className="text-2xl font-black italic tracking-tighter">{asset.downloadCount}</p>
                        <p className="text-[8px] font-black uppercase text-zinc-800 mt-1">Downloads</p>
                      </div>
                      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                        <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{asset.fileType.substring(1)}</p>
                        <p className="text-[8px] font-black uppercase text-zinc-800 mt-1">Format</p>
                      </div>
                    </div>

                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.04] transition-all group/node" onClick={() => { setViewingUserId(asset.userId); setActiveTab('profile'); setSelectedAssetId(null); }}>
                      <div className="flex items-center gap-3 mb-3">
                        <img src={asset.authorAvatar} className="w-6 h-6 rounded-full border border-white/10" />
                        <span className="text-[9px] font-black uppercase text-zinc-400 truncate group-hover/node:text-white">@{asset.authorName}</span>
                      </div>
                      <p className="text-[8px] text-zinc-800 uppercase font-black italic tracking-widest">Entry: {new Date(asset.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl text-[11px] tracking-[0.2em] hover:brightness-90 transition-all shadow-2xl active:scale-95">DOWNLOAD ASSET</button>
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Access Node</h2>
          <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] italic">Join the Excalibur Network</p>
        </div>
        <div id="google-signin-btn" className="w-full mb-8 flex justify-center" />
        <p className="text-[9px] text-zinc-800 text-center font-black uppercase tracking-widest leading-relaxed">
          Authenticate to sync entries across the decentralized cloud architecture.
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
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-8 duration-500">
        {isUploading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-8 text-center">
            <div className="w-16 h-16 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin shadow-lg shadow-blue-500/10" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Broadcasting...</h2>
              <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.4em] italic">Synchronizing with global cloud nodes</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Upload Entry</h2>
                <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest italic">Encrypted Broadcast</p>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-800 hover:text-white transition-all bg-white/5 rounded-full rotate-45"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-700 tracking-widest ml-1">Asset Label</label>
                <input required type="text" placeholder="e.g. Tactical UI Engine" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-900 font-bold" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-700 tracking-widest ml-1">Technical Manual</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all h-28 resize-none placeholder:text-zinc-900 font-medium" placeholder="Describe the resource..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-700 tracking-widest ml-1">Binary File (.rbxm/.rbxl)</label>
                <label className={`w-full p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'bg-white/5 border-white/10 text-zinc-700 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <Icons.Script />
                  <span className="font-black text-[11px] tracking-widest mt-3 uppercase italic">{rbxFile ? rbxFile.name : "Select Payload"}</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-700 tracking-widest ml-1">Cover Art</label>
                  <label className={`w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-700 tracking-widest ml-1">Classification</label>
                  <select className="w-full h-28 bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none text-center font-black text-[11px] uppercase italic tracking-widest" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl text-[11px] tracking-[0.3em] hover:brightness-90 transition-all shadow-2xl active:scale-95">CONFIRM GLOBAL BROADCAST</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
