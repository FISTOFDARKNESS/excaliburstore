
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Asset, User, Category, RobloxFileType, Comment } from './types';
import { Icons } from './constants';
import { githubStorage } from './services/githubService';
import { generateKeywords } from './services/geminiService';

declare global {
  interface Window {
    google: any;
  }
}

const ADMIN_EMAILS = ['kaioadrik08@gmail.com'];
const ALLOWED_ROBLOX_EXTENSIONS = ['.rbxm', '.rbxl', '.rbxmx'];

// Componente de Card com Hover Inteligente (1.2s)
const AssetCard: React.FC<{ asset: Asset, currentUser: User | null, onClick: () => void }> = ({ asset, currentUser, onClick }) => {
  const [showVideo, setShowVideo] = useState(false);
  const hoverTimer = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowVideo(true), 1200);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowVideo(false);
  };

  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [showVideo]);

  return (
    <div 
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="premium-card group rounded-[1.5rem] overflow-hidden cursor-pointer border border-white/5 flex flex-col h-[380px] relative"
    >
      <div className="h-[200px] w-full relative overflow-hidden bg-zinc-900 flex items-center justify-center">
        {asset.reports > 0 && (
          <div className="absolute top-4 right-4 bg-red-600/80 backdrop-blur-md p-1.5 rounded-lg border border-red-500/50 text-white z-20 shadow-lg animate-pulse">
            <Icons.Report />
          </div>
        )}
        
        <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
           <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[7px] font-black tracking-widest border border-white/10 uppercase shadow-xl">
             ID: {asset.id.split('-').pop()}
           </div>
           {asset.authorVerified && (
             <div className="bg-blue-500/20 backdrop-blur-md p-1.5 rounded-lg border border-blue-500/30">
               <Icons.Verified />
             </div>
           )}
        </div>
        
        <img 
          src={`${asset.thumbnailUrl}?t=${asset.timestamp}`} 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-0' : 'opacity-100'} group-hover:scale-110`}
          alt={asset.title}
        />

        {showVideo && asset.videoUrl && (
          <video 
            ref={videoRef}
            src={`${asset.videoUrl}?t=${asset.timestamp}`} 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500" 
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="p-6 flex flex-col justify-between flex-grow bg-gradient-to-b from-transparent to-black/40">
        <div>
          <h3 className="text-xl font-black uppercase italic truncate mb-1 flex items-center gap-2">
            {asset.title}
            {asset.authorVerified && <Icons.Verified className="text-blue-400" />}
          </h3>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            Provider: {asset.authorName}
            {asset.authorVerified && <Icons.Verified className="w-2.5 h-2.5" />}
          </p>
        </div>
        <div className="flex justify-between items-center text-[8px] font-black text-zinc-400 uppercase tracking-widest pt-4 border-t border-white/5 mt-2">
          <span className="bg-white/5 px-3 py-1 rounded-md border border-white/5">{asset.category}</span>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} /> {asset.likes?.length || 0}</span>
            <span className="flex items-center gap-1.5"><Icons.Download /> {asset.downloadCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

type TabId = 'explore' | 'verified' | 'market' | 'profile';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStep, setUploadStep] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const detailVideoRef = useRef<HTMLVideoElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  const isAdmin = (user: User | null) => user ? ADMIN_EMAILS.includes(user.email) : false;

  const syncRegistry = useCallback(async () => {
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const init = async () => {
      await syncRegistry();
      const session = localStorage.getItem('ex_session_v2');
      if (session) {
        try {
          const u = JSON.parse(session);
          const fresh = await githubStorage.getUserProfile(u.id);
          if (fresh) setCurrentUser(fresh.user);
        } catch { localStorage.removeItem('ex_session_v2'); }
      }
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  useEffect(() => {
    if (selectedAsset && detailVideoRef.current) {
      detailVideoRef.current.play().catch(() => {});
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (currentUser) return;
    
    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const timer = setInterval(() => {
      const btn = document.getElementById('google-login-btn');
      if (window.google?.accounts?.id && btn) {
        window.google.accounts.id.initialize({
          client_id: "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com",
          callback: async (response: any) => {
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const user = await githubStorage.syncUserProfile({
              id: payload.sub,
              name: payload.name,
              email: payload.email,
              avatar: payload.picture
            });
            setCurrentUser(user);
            localStorage.setItem('ex_session_v2', JSON.stringify(user));
          },
        });
        window.google.accounts.id.renderButton(btn, { 
          theme: 'filled_black', 
          size: 'large', 
          shape: 'pill',
          width: btn.offsetWidth
        });
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogout = () => {
    if (confirm("Deseja encerrar a sessão atual?")) {
      setCurrentUser(null);
      localStorage.removeItem('ex_session_v2');
      window.location.reload();
    }
  };

  const handleSaveName = async () => {
    if (!currentUser || !newName.trim() || isSavingName) return;
    if (newName.trim() === currentUser.name) {
      setIsEditingName(false);
      return;
    }
    
    setIsSavingName(true);
    setNameError('');
    try {
      const updated = await githubStorage.changeUsername(currentUser.id, newName.trim());
      setCurrentUser(updated);
      localStorage.setItem('ex_session_v2', JSON.stringify(updated));
      setIsEditingName(false);
      if (viewedUser?.id === currentUser.id) setViewedUser(updated);
      alert("Identidade Reconfigurada com Sucesso.");
    } catch (e: any) {
      setNameError(e.message || "Falha na recalibração de nome.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleFollow = async (targetId: string) => {
    if (!currentUser) return alert("Login necessário");
    try {
      await githubStorage.toggleFollow(currentUser.id, targetId);
      const freshActor = await githubStorage.getUserProfile(currentUser.id);
      const freshTarget = await githubStorage.getUserProfile(targetId);
      if (freshActor) setCurrentUser(freshActor.user);
      if (freshTarget && viewedUser?.id === targetId) setViewedUser(freshTarget.user);
    } catch (e) { alert("Erro ao seguir"); }
  };

  const handleVerify = async (userId: string, status: boolean) => {
    if (!isAdmin(currentUser)) return;
    try {
      await githubStorage.verifyUser(userId, status);
      const fresh = await githubStorage.getUserProfile(userId);
      if (fresh && viewedUser?.id === userId) setViewedUser(fresh.user);
      alert(status ? "Selo de Verificação Concedido!" : "Selo de Verificação Removido.");
    } catch (e) { alert("Erro ao processar verificação"); }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login necessário para adquirir files.");
    window.open(asset.fileUrl, '_blank');
    const updated = await githubStorage.incrementDownload(asset.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleLike = async (assetId: string) => {
    if (!currentUser) return alert("Login necessário");
    try {
      const updated = await githubStorage.toggleLike(assetId, currentUser.id);
      setAssets(prev => prev.map(a => a.id === assetId ? updated : a));
      if (selectedAsset?.id === assetId) setSelectedAsset(updated);
    } catch (e) { alert("Erro ao curtir"); }
  };

  const handleReport = async (assetId: string) => {
    if (!currentUser) return alert("Login necessário para denunciar");
    if (!confirm("Deseja denunciar este conteúdo por violação das diretrizes?")) return;
    try {
      const updated = await githubStorage.incrementReport(assetId);
      setAssets(prev => prev.map(a => a.id === assetId ? updated : a));
      if (selectedAsset?.id === assetId) setSelectedAsset(updated);
      alert("Conteúdo denunciado. Nossa equipe irá analisar.");
    } catch (e) { alert("Falha ao enviar denúncia"); }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm("TEM CERTEZA? Esta ação removerá permanentemente os arquivos do servidor.")) return;
    setLoading(true);
    try {
      await githubStorage.removeAsset(assetId);
      await syncRegistry();
      setSelectedAsset(null);
      alert("Asset eliminado com sucesso.");
    } catch (e) { alert("Falha ao remover asset."); }
    finally { setLoading(false); }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedAsset || !commentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const updated = await githubStorage.addComment(selectedAsset.id, {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        text: commentText.trim(),
        timestamp: Date.now()
      });
      setSelectedAsset(updated);
      setCommentText('');
    } catch (e) { alert("Erro ao postar feedback."); }
    finally { setIsPostingComment(false); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;

    if (!ALLOWED_ROBLOX_EXTENSIONS.some(ext => assetFile.name.toLowerCase().endsWith(ext))) {
      return alert("BLOQUEADO: Apenas .rbxm, .rbxl ou .rbxmx.");
    }
    
    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress("Protocolo IA: Gerando Keywords Semânticas...");
    
    try {
      const title = formData.get('title') as string;
      const desc = formData.get('desc') as string;
      const keywords = await generateKeywords(title, desc);
      
      setUploadStep(2);
      const asset: Asset = {
        id: `EXC-${Date.now().toString(36).toUpperCase()}`,
        userId: currentUser.id, authorName: currentUser.name, authorAvatar: currentUser.avatar,
        title, description: desc, originalFileName: assetFile.name,
        category: formData.get('category') as Category,
        fileType: assetFile.name.slice(assetFile.name.lastIndexOf('.')) as RobloxFileType,
        thumbnailUrl: '', fileUrl: '', downloadCount: 0, likes: [], reports: 0, credits: formData.get('credits') as string,
        comments: [], timestamp: Date.now(), keywords,
        authorVerified: currentUser.isVerified
      };

      await githubStorage.uploadAsset(asset, { asset: assetFile, thumb: thumbFile, video: videoFile }, (msg) => {
        setUploadProgress(msg);
        setUploadStep(prev => Math.min(prev + 1, 6));
      });

      setIsUploading(false);
      setShowUpload(false);
      setUploadStep(0);
      syncRegistry();
    } catch (err) {
      alert("Erro na transmissão.");
      setIsUploading(false);
    }
  };

  const openUserProfile = async (userId: string) => {
    setLoading(true);
    const data = await githubStorage.getUserProfile(userId);
    if (data) {
      setViewedUser(data.user);
      setSelectedAsset(null);
      setNewName(data.user.name);
      setIsEditingName(false);
      setNameError('');
    }
    setLoading(false);
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) {
        list = list.filter(a => a.userId === currentUser.id);
    } else if (activeTab === 'verified') {
        list = list.filter(a => a.authorVerified === true);
    }
    const q = searchQuery.toLowerCase();
    return q ? list.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.id.toLowerCase().includes(q) || 
      a.keywords.some(k => k.toLowerCase().includes(q))
    ) : list;
  }, [assets, searchQuery, activeTab, currentUser]);

  const userAssets = useMemo(() => viewedUser ? assets.filter(a => a.userId === viewedUser.id) : [], [assets, viewedUser]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-black text-[10px] font-black uppercase tracking-[1em] animate-pulse">EXCALIBUR OS // PROCESSING</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 border-r border-white/5 flex flex-col p-6 lg:fixed h-auto lg:h-full z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center rotate-3"><Icons.Model /></div>
          <h1 className="font-black italic text-lg tracking-tighter">EXCALIBUR</h1>
        </div>
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
          {(['explore', 'verified', 'market', 'profile'] as TabId[]).map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-3 p-3.5 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all ${activeTab === id ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
               {id === 'explore' ? <Icons.Search /> : 
                id === 'verified' ? <Icons.Verified className={activeTab === id ? "text-black" : "text-blue-500"} /> :
                id === 'market' ? <Icons.Script /> : <Icons.Plus />}
               <span>{id}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5">
          {currentUser ? (
            <div className="relative group">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3 cursor-pointer group-hover:opacity-20 transition-all" onClick={() => openUserProfile(currentUser.id)}>
                <img src={currentUser.avatar} className="w-7 h-7 rounded-lg grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="flex-grow min-w-0">
                  <p className="text-[9px] font-black truncate flex items-center gap-1">
                    {currentUser.name} {currentUser.isVerified && <Icons.Verified className="w-3 h-3 text-blue-400" />}
                  </p>
                  <p className="text-[7px] text-zinc-500 font-bold uppercase">{currentUser.followers.length} Followers</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="absolute inset-0 w-full h-full flex items-center justify-center bg-red-600/90 rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-xl z-10"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest text-center">Protocolo de Login Seguro</p>
              <div id="google-login-btn" className="w-full flex justify-center"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-64 p-6 lg:p-12">
        <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
           {activeTab === 'verified' && (
             <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/5 blur-[120px] pointer-events-none rounded-full" />
           )}
           <div>
              <h2 className={`text-5xl font-black italic uppercase tracking-tighter leading-none ${activeTab === 'verified' ? 'text-blue-400' : ''}`}>{activeTab}</h2>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Unique Roblox Repository</p>
           </div>
           <div className="flex items-center gap-3 w-full md:w-auto">
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PROTOCOL SEARCH..." className="w-full md:w-64 bg-zinc-900 border border-white/5 rounded-xl py-4 px-6 text-[10px] font-black outline-none focus:border-white/20 transition-all" />
           </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />)}
          {filteredAssets.length === 0 && (
            <div className="col-span-full py-24 text-center opacity-40">
              <p className="text-zinc-600 font-black uppercase tracking-[0.5em] text-[10px]">Nenhum registro no setor.</p>
            </div>
          )}
        </div>

        {currentUser && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-10 right-10 bg-white text-black w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[6px] border-black">
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Profile Modal */}
      {viewedUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setViewedUser(null)} />
          <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
             <div className="p-10 border-b border-white/5 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-r from-blue-900/10 via-transparent to-transparent">
                <img src={viewedUser.avatar} className="w-32 h-32 rounded-3xl border border-white/10 shadow-2xl grayscale hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="flex-grow">
                   <div className="flex flex-col gap-2 mb-2">
                      {isEditingName && currentUser?.id === viewedUser.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input 
                              autoFocus
                              value={newName}
                              onChange={e => { setNewName(e.target.value); setNameError(''); }}
                              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-2xl font-black italic uppercase outline-none focus:border-white/30"
                              placeholder="NOVO NOME..."
                            />
                            <button 
                              onClick={handleSaveName}
                              disabled={isSavingName}
                              className="bg-white text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-zinc-200 transition-all"
                            >
                              {isSavingName ? 'Verificando...' : 'Salvar'}
                            </button>
                            <button 
                              onClick={() => setIsEditingName(false)}
                              className="px-4 py-3 rounded-xl border border-white/10 text-zinc-500 font-black text-[10px] uppercase"
                            >
                              X
                            </button>
                          </div>
                          {nameError && <p className="text-red-500 text-[9px] font-black uppercase tracking-widest">{nameError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none flex items-center gap-2">
                            {viewedUser.name}
                            {viewedUser.isVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
                          </h2>
                          {currentUser?.id === viewedUser.id && (
                            <button onClick={() => setIsEditingName(true)} className="text-zinc-600 hover:text-white transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      {viewedUser.isVerified ? (
                        <span className="w-fit bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                           <Icons.Verified className="w-3 h-3" /> Verified Agent
                        </span>
                      ) : (
                        <span className="w-fit bg-zinc-800/50 text-zinc-500 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Unverified Agent</span>
                      )}
                   </div>
                   <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <span className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> {viewedUser.followers.length} Seguidores</span>
                      <span className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> {viewedUser.following.length} Seguindo</span>
                      <span className="flex items-center gap-2"><div className="w-1 h-1 bg-white rounded-full"/> {userAssets.length} Assets</span>
                   </div>
                </div>
                <div className="flex flex-col gap-3">
                  {currentUser && currentUser.id !== viewedUser.id && (
                    <button onClick={() => handleFollow(viewedUser.id)} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg active:scale-95 ${currentUser.following.includes(viewedUser.id) ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white text-black'}`}>
                      {currentUser.following.includes(viewedUser.id) ? 'Unfollow' : 'Follow'}
                    </button>
                  )}
                  {isAdmin(currentUser) && (
                    <button onClick={() => handleVerify(viewedUser.id, !viewedUser.isVerified)} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase shadow-lg active:scale-95">
                       {viewedUser.isVerified ? 'Remove Verified' : 'Grant Verified'}
                    </button>
                  )}
                </div>
             </div>
             <div className="p-10 overflow-y-auto custom-scrollbar flex-grow">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-8 italic">User Repositories</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userAssets.map(asset => (
                    <div key={asset.id} onClick={() => { setSelectedAsset(asset); setViewedUser(null); }} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all group">
                       <img src={asset.thumbnailUrl} className="w-16 h-16 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all" />
                       <div className="min-w-0">
                          <p className="font-black uppercase text-[12px] truncate">{asset.title}</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">{asset.category} • {asset.downloadCount} DL</p>
                       </div>
                    </div>
                  ))}
                  {userAssets.length === 0 && <p className="col-span-full text-center text-[10px] font-black uppercase text-zinc-700 py-12">Nenhum asset publicado ainda.</p>}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Asset Detail View */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-5xl bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col lg:flex-row max-h-[85vh] shadow-2xl">
            {/* Left: Content */}
            <div className="lg:w-3/5 p-10 overflow-y-auto custom-scrollbar border-r border-white/5">
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black mb-10 border border-white/10 shadow-2xl relative">
                <video 
                  ref={detailVideoRef}
                  src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} 
                  autoPlay 
                  muted 
                  loop 
                  playsInline 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter flex items-center gap-3">
                    {selectedAsset.title}
                    {selectedAsset.authorVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
                  </h2>
                  <div className="flex gap-2 mt-4">
                     <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase">{selectedAsset.category}</span>
                     <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase">{selectedAsset.fileType}</span>
                  </div>
                </div>
              </div>
              <p className="text-zinc-400 mb-10 text-sm bg-white/[0.02] p-6 rounded-[1.5rem] border border-white/5 italic leading-relaxed whitespace-pre-wrap">"{selectedAsset.description}"</p>
              
              <div className="mt-12 pt-12 border-t border-white/5">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 italic">Protocol Feedback</h3>
                {currentUser ? (
                  <form onSubmit={handleCommentSubmit} className="mb-10 relative group">
                    <textarea 
                      value={commentText} 
                      onChange={e => setCommentText(e.target.value)} 
                      placeholder="Send encrypted feedback..." 
                      className="w-full bg-zinc-900 border border-white/5 rounded-[1.5rem] p-6 text-[11px] font-black uppercase outline-none focus:border-white/20 transition-all min-h-[100px] resize-none" 
                    />
                    <button type="submit" disabled={isPostingComment || !commentText.trim()} className="absolute bottom-4 right-4 bg-white text-black px-8 py-2 rounded-xl text-[9px] font-black uppercase shadow-xl hover:bg-zinc-200 transition-all">
                       {isPostingComment ? 'Transmitting...' : 'Send'}
                    </button>
                  </form>
                ) : (
                  <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-[1.5rem] p-10 text-center mb-10">
                    <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Login necessário para comentar</p>
                  </div>
                )}
                <div className="space-y-6">
                  {selectedAsset.comments?.length > 0 ? selectedAsset.comments.map(c => (
                    <div key={c.id} className="bg-white/[0.03] border border-white/5 p-6 rounded-[1.5rem] flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <img src={c.userAvatar} className="w-10 h-10 rounded-lg cursor-pointer grayscale hover:grayscale-0 transition-all" onClick={() => openUserProfile(c.userId)} referrerPolicy="no-referrer" />
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[10px] font-black uppercase flex items-center gap-1.5">
                            {c.userName}
                            {/* In a real app we'd fetch the specific user's verified status, for now we can rely on cached status if available in asset data or similar */}
                            <Icons.Verified className="w-3 h-3 text-blue-500/50" />
                          </p>
                          <span className="text-[8px] text-zinc-600 font-black">{new Date(c.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] italic leading-relaxed">"{c.text}"</p>
                      </div>
                    </div>
                  )) : <p className="text-center py-10 text-[9px] font-black uppercase text-zinc-800 tracking-[0.4em] italic">Nenhum feedback registrado.</p>}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="lg:w-2/5 p-10 flex flex-col justify-between bg-black/40">
              <div className="space-y-8">
                <div className="p-6 bg-white/[0.04] rounded-[2rem] border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all shadow-xl group" onClick={() => openUserProfile(selectedAsset.userId)}>
                  <img src={selectedAsset.authorAvatar} className="w-14 h-14 rounded-xl border border-white/10 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Provider</p>
                    <p className="text-[14px] font-black uppercase flex items-center gap-2 truncate">
                      {selectedAsset.authorName}
                      {selectedAsset.authorVerified && <Icons.Verified className="w-4 h-4 text-blue-500" />}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/5 text-center shadow-lg">
                      <p className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">Downloads</p>
                      <p className="text-2xl font-black tracking-tighter">{selectedAsset.downloadCount}</p>
                   </div>
                   <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/5 text-center shadow-lg">
                      <p className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">Likes</p>
                      <p className="text-2xl font-black tracking-tighter">{selectedAsset.likes.length}</p>
                   </div>
                </div>

                <div className="space-y-4">
                  <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-3xl bg-white text-black font-black uppercase text-[11px] shadow-2xl active:scale-95 hover:bg-zinc-200 transition-all flex items-center justify-center gap-3">
                    <Icons.Download /> ADQUIRIR FILE
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleLike(selectedAsset.id)} className={`py-6 rounded-2xl border border-white/5 font-black uppercase text-[9px] flex items-center justify-center gap-2 active:scale-95 transition-all ${selectedAsset.likes.includes(currentUser?.id || '') ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5'}`}>
                       <Icons.Like filled={selectedAsset.likes.includes(currentUser?.id || '')} /> Like
                    </button>
                    <button onClick={() => handleReport(selectedAsset.id)} className="py-6 rounded-2xl bg-red-900/10 border border-red-900/30 text-red-500 font-black uppercase text-[9px] flex items-center justify-center gap-2 active:scale-95 hover:bg-red-900/20 transition-all">
                       <Icons.Report /> Report
                    </button>
                  </div>
                  {(isAdmin(currentUser) || (currentUser && currentUser.id === selectedAsset.userId)) && (
                    <button onClick={() => handleDelete(selectedAsset.id)} className="w-full py-4 rounded-2xl border border-red-600 text-red-500 font-black uppercase text-[9px] hover:bg-red-600 hover:text-white transition-all shadow-lg mt-4">
                      ELIMINAR ASSET (PROPRIETÁRIO/ADMIN)
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[9px] font-black uppercase text-zinc-700 hover:text-white transition-colors tracking-[0.4em] mt-8">Terminar Sessão</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-2xl bg-[#080808] border border-white/10 p-10 rounded-[3rem] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
             <h2 className="text-3xl font-black italic uppercase mb-10 tracking-tighter">Transmissão de Asset</h2>
             {isUploading ? (
               <div className="py-20 flex flex-col items-center gap-10">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                    <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="w-full max-sm space-y-4">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500">
                      <span>Uploading Protocol</span>
                      <span>{Math.round((uploadStep / 6) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-white transition-all duration-500" style={{ width: `${(uploadStep / 6) * 100}%` }} />
                    </div>
                    <p className="text-center text-[10px] font-black uppercase italic animate-pulse text-zinc-300">{uploadProgress}</p>
                  </div>
               </div>
             ) : (
               <div className="space-y-6">
                 <input required name="title" placeholder="ASSET TITLE" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 text-[10px] font-black uppercase outline-none focus:border-white/20" />
                 <textarea required name="desc" placeholder="SPECIFICATIONS" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 h-32 text-[10px] font-black uppercase outline-none focus:border-white/20 resize-none" />
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Roblox File (.rbxm, .rbxl)</label>
                     <input required name="file" type="file" accept=".rbxm,.rbxl,.rbxmx" className="w-full text-[8px] text-zinc-400 bg-white/5 p-3 rounded-xl border border-white/5" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Category</label>
                     <select name="category" className="bg-zinc-900 w-full p-3.5 rounded-xl text-[9px] font-black uppercase border border-white/5 outline-none">
                       {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Thumbnail (PNG/JPG)</label>
                     <input required name="thumb" type="file" accept="image/*" className="w-full text-[8px] text-zinc-400 bg-white/5 p-3 rounded-xl border border-white/5" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Preview Video (MP4)</label>
                     <input required name="video" type="file" accept="video/mp4" className="w-full text-[8px] text-zinc-400 bg-white/5 p-3 rounded-xl border border-white/5" />
                   </div>
                 </div>
                 <input required name="credits" placeholder="CREDITS / OWNERSHIP" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 text-[10px] font-black uppercase outline-none focus:border-white/20" />
                 <button type="submit" className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl active:scale-95 hover:bg-zinc-200 transition-all">Execute Transmission</button>
               </div>
             )}
          </form>
        </div>
      )}
    </div>
  );
}
