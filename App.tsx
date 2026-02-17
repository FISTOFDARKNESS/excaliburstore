
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

const AssetCard: React.FC<{ asset: Asset, currentUser: User | null, onClick: () => void, isVerifiedTab?: boolean }> = ({ asset, currentUser, onClick, isVerifiedTab }) => {
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
      className={`premium-card group rounded-[1.5rem] overflow-hidden cursor-pointer border flex flex-col h-[380px] relative transition-all duration-500 ${asset.reports > 5 ? 'opacity-50 grayscale' : 'opacity-100'} ${isVerifiedTab ? 'border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'border-white/5'}`}
    >
      <div className="h-[200px] w-full relative overflow-hidden bg-zinc-900 flex items-center justify-center">
        {asset.reports > 0 && (
          <div className="absolute top-4 right-4 bg-red-600/80 backdrop-blur-md p-1.5 rounded-lg border border-red-500/50 text-white z-20 shadow-lg animate-pulse flex items-center gap-1.5 px-2">
            <Icons.Report className="w-3 h-3" /> <span className="text-[8px] font-black uppercase">{asset.reports}</span>
          </div>
        )}
        
        <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
           <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[7px] font-black tracking-widest border border-white/10 uppercase shadow-xl">
             ID: {asset.id.split('-').pop()}
           </div>
           {asset.authorVerified && (
             <div className="bg-blue-500/20 backdrop-blur-md p-1.5 rounded-lg border border-blue-500/30">
               <Icons.Verified className="w-3 h-3 text-blue-500" />
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
            {asset.authorVerified && <Icons.Verified className="w-5 h-5" />}
          </h3>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            Provider: {asset.authorName}
            {asset.authorVerified && <Icons.Verified className="w-3 h-3" />}
          </p>
        </div>
        <div className="flex justify-between items-center text-[8px] font-black text-zinc-400 uppercase tracking-widest pt-4 border-t border-white/5 mt-2">
          <span className={`px-3 py-1 rounded-md border ${isVerifiedTab ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/5'}`}>{asset.category}</span>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} className="w-4 h-4" /> {asset.likes?.length || 0}</span>
            <span className="flex items-center gap-1.5"><Icons.Download className="w-4 h-4" /> {asset.downloadCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

type TabId = 'explore' | 'verified' | 'market' | 'profile' | 'admin';
type AdminSubTab = 'all' | 'verified' | 'banned' | 'reports';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('all');
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

  const isAdmin = (user: User | null) => user ? (user.isAdmin || ADMIN_EMAILS.includes(user.email)) : false;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (isAdmin(currentUser)) {
          setActiveTab('admin');
          alert("ACESSO AO COMMAND CENTER INICIADO.");
        } else {
          console.warn("Acesso administrativo negado: Credenciais insuficientes.");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  useEffect(() => {
  if (!loading && activeTab === 'admin' && !isAdmin(currentUser)) {
    setActiveTab('explore');
  }
}, [activeTab, currentUser, loading]);


  const syncRegistry = useCallback(async () => {
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin(currentUser)) return;
    const users = await githubStorage.getAllUsers();
    setAllUsers(users);
  }, [currentUser]);

  useEffect(() => {
    const init = async () => {
      await syncRegistry();
      const session = localStorage.getItem('ex_session_v3');
      if (session) {
        try {
          const u = JSON.parse(session);
          const fresh = await githubStorage.getUserProfile(u.id);
          if (fresh) {
            if (fresh.user.isBanned) {
                alert("ACESSO NEGADO: Sua conta foi suspensa por violação das diretrizes.");
                localStorage.removeItem('ex_session_v3');
                window.location.reload();
            } else {
                setCurrentUser(fresh.user);
            }
          }
        } catch { localStorage.removeItem('ex_session_v3'); }
      }
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  useEffect(() => {
    if (activeTab === 'admin') fetchUsers();
  }, [activeTab, fetchUsers]);

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
            
            if (user.isBanned) {
                alert("ACESSO NEGADO.");
                return;
            }

            if (isAdmin(user)) {
               alert(`BEM-VINDO, ADMINISTRADOR ${user.name.toUpperCase()}. Atalho Ctrl+B habilitado.`);
            }

            setCurrentUser(user);
            localStorage.setItem('ex_session_v3', JSON.stringify(user));
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
      localStorage.removeItem('ex_session_v3');
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
      localStorage.setItem('ex_session_v3', JSON.stringify(updated));
      setIsEditingName(false);
      if (viewedUser?.id === currentUser.id) setViewedUser(updated);
      alert("Identidade Reconfigurada com Sucesso.");
    } catch (e: any) {
      setNameError(e.message || "Falha na recalibração de nome.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAdminUserAction = async (userId: string, action: 'ban' | 'verify' | 'unverify' | 'edit_name') => {
    if (!isAdmin(currentUser)) return;
    setLoading(true);
    try {
      if (action === 'ban') {
        const u = await githubStorage.toggleBan(userId);
        alert(u.isBanned ? "Agente Terminado (Banido)." : "Agente Reintegrado.");
      } else if (action === 'verify' || action === 'unverify') {
        await githubStorage.verifyUser(userId, action === 'verify');
        alert("Protocolo de Verificação Atualizado.");
      } else if (action === 'edit_name') {
        const name = prompt("Defina o novo nome universal para este agente:");
        if (name && name.trim()) {
            await githubStorage.changeUsername(userId, name.trim());
            alert("Sincronização de Nome Completa.");
        }
      }
      await fetchUsers();
    } catch (e: any) {
      alert("FALHA CRÍTICA: " + e.message);
    } finally {
      setLoading(false);
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
    if (!confirm("CONFIRMAR ELIMINAÇÃO: Esta ação removerá permanentemente os arquivos do servidor.")) return;
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

  const filteredAdminUsers = useMemo(() => {
    let list = allUsers;
    if (adminSubTab === 'verified') list = list.filter(u => u.isVerified);
    else if (adminSubTab === 'banned') list = list.filter(u => u.isBanned);
    
    const q = adminSearch.toLowerCase();
    if (q) {
        list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
    }
    return list;
  }, [allUsers, adminSubTab, adminSearch]);

  const reportedAssets = useMemo(() => assets.filter(a => a.reports > 0).sort((a,b) => b.reports - a.reports), [assets]);

  const userAssets = useMemo(() => viewedUser ? assets.filter(a => a.userId === viewedUser.id) : [], [assets, viewedUser]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-black text-[10px] font-black uppercase tracking-[1em] animate-pulse">EXCALIBUR OS // PROCESSING</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 border-r border-white/5 flex flex-col p-6 lg:fixed h-auto lg:h-full z-50 bg-[#050505] shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center rotate-3"><Icons.Model className="w-5 h-5 text-black" /></div>
          <h1 className="font-black italic text-lg tracking-tighter">EXCALIBUR</h1>
        </div>
        <nav className="flex flex-col gap-1.5 pb-4">
          <button onClick={() => setActiveTab('explore')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'explore' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Search className="w-5 h-5" />
             <span>EXPLORE</span>
          </button>
          
          <button onClick={() => setActiveTab('verified')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'verified' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Verified className={`w-5 h-5 ${activeTab === 'verified' ? 'text-white' : 'text-blue-500'}`} />
             <span>VERIFIED</span>
          </button>
          
          <button onClick={() => setActiveTab('market')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'market' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Script className="w-5 h-5" />
             <span>MARKET</span>
          </button>
          
          <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Plus className="w-5 h-5" />
             <span>PROFILE</span>
          </button>

          {isAdmin(currentUser) && (
            <button onClick={() => setActiveTab('admin')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all mt-6 ${activeTab === 'admin' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'text-red-500 hover:bg-red-500/10'}`}>
               <Icons.Report className="w-5 h-5" />
               <span>ADMIN PANEL</span>
            </button>
          )}
        </nav>
        
        <div className="mt-auto pt-6 border-t border-white/5">
          {currentUser ? (
            <div className="relative group">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3 cursor-pointer group-hover:opacity-20 transition-all" onClick={() => openUserProfile(currentUser.id)}>
                <img src={currentUser.avatar} className="w-8 h-8 rounded-lg grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="flex-grow min-w-0">
                  <p className="text-[10px] font-black truncate flex items-center gap-1.5">
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
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-center">Protocolo de Login Seguro</p>
              <div id="google-login-btn" className="w-full flex justify-center"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-64 p-6 lg:p-12 min-h-screen">
        {activeTab === 'admin' && isAdmin(currentUser) ? (
            <div className="animate-in fade-in duration-500">
                <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none text-red-600">Command Center</h2>
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Atalho rápido ativado: CTRL + B</p>
                    </div>
                    <div className="flex gap-2">
                    
                        {(['all', 'verified', 'banned', 'reports'] as AdminSubTab[]).map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => setAdminSubTab(tab)} 
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${adminSubTab === tab ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-500'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </header>
                
                {adminSubTab === 'reports' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {reportedAssets.map(asset => (
                            <div key={asset.id} className="bg-zinc-900 border border-red-500/20 rounded-2xl overflow-hidden p-6 relative">
                                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{asset.reports} REPORTS</div>
                                <h3 className="text-lg font-black uppercase italic mb-2">{asset.title}</h3>
                                <p className="text-[9px] text-zinc-500 uppercase mb-4">By: {asset.authorName} (ID: {asset.id})</p>
                                <div className="flex gap-2 mt-auto">
                                    <button onClick={() => setSelectedAsset(asset)} className="flex-grow bg-white/5 py-2 rounded-lg text-[9px] font-black uppercase">Inspect</button>
                                    <button onClick={() => handleDelete(asset.id)} className="flex-grow bg-red-600 py-2 rounded-lg text-[9px] font-black uppercase text-white">Purge Asset</button>
                                </div>
                            </div>
                        ))}
                        {reportedAssets.length === 0 && <p className="col-span-full text-center py-20 text-zinc-600 font-black uppercase tracking-widest">Nenhuma anomalia detectada.</p>}
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <input 
                                value={adminSearch} 
                                onChange={e => setAdminSearch(e.target.value)} 
                                placeholder="LOCALIZAR AGENTE POR NOME, ID OU EMAIL..." 
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl py-4 px-6 text-[10px] font-black uppercase outline-none focus:border-red-600/50 transition-all"
                            />
                        </div>
                        <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                            <table className="w-full text-[9px] font-black uppercase tracking-widest">
                                <thead className="bg-white/5 border-b border-white/5 text-zinc-500">
                                    <tr>
                                        <th className="p-6 text-left">Agent Entity</th>
                                        <th className="p-6 text-left">Clearance</th>
                                        <th className="p-6 text-left">Stats</th>
                                        <th className="p-6 text-left">Protocol Status</th>
                                        <th className="p-6 text-right">Directives</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAdminUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <img src={u.avatar} className={`w-8 h-8 rounded-lg ${u.isBanned ? 'grayscale opacity-30' : ''}`} referrerPolicy="no-referrer" />
                                                    <div>
                                                        <p className={`flex items-center gap-1.5 text-[11px] italic ${u.isBanned ? 'line-through text-zinc-700' : ''}`}>
                                                            {u.name} {u.isVerified && <Icons.Verified className="w-3 h-3 text-blue-500" />}
                                                        </p>
                                                        <p className="text-[7px] text-zinc-600">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-zinc-400">
                                                {ADMIN_EMAILS.includes(u.email) || u.isAdmin ? <span className="text-red-500 font-black">ROOT ADMIN</span> : "STANDARD AGENT"}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex gap-4">
                                                    <span>FLW: {u.followers.length}</span>
                                                    <span>ING: {u.following.length}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex gap-2">
                                                    {u.isBanned && <span className="bg-red-600 text-white px-2 py-0.5 rounded border border-red-500/30 text-[7px]">TERMINATED</span>}
                                                    {u.isVerified && <span className="bg-blue-600 text-white px-2 py-0.5 rounded border border-blue-500/30 text-[7px]">VERIFIED</span>}
                                                    {!u.isBanned && !u.isVerified && <span className="text-zinc-700">ACTIVE</span>}
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleAdminUserAction(u.id, 'edit_name')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400">EDIT NAME</button>
                                                    <button onClick={() => handleAdminUserAction(u.id, u.isVerified ? 'unverify' : 'verify')} className={`px-3 py-1.5 rounded-lg ${u.isVerified ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-600 text-white'}`}>{u.isVerified ? 'REVOKE' : 'VERIFY'}</button>
                                                    <button onClick={() => handleAdminUserAction(u.id, 'ban')} className={`px-3 py-1.5 rounded-lg font-black ${u.isBanned ? 'bg-white text-black' : 'bg-red-600 text-white'}`}>{u.isBanned ? 'RESTORE' : 'TERMINATE'}</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        ) : (
            <div className="animate-in fade-in duration-700">
                <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
                    {activeTab === 'verified' && (
                        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] pointer-events-none rounded-full animate-pulse" />
                    )}
                    <div>
                        <h2 className={`text-6xl font-black italic uppercase tracking-tighter leading-none flex items-center gap-4 ${activeTab === 'verified' ? 'text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-white'}`}>
                          {activeTab}
                          {activeTab === 'verified' && <Icons.Verified className="w-12 h-12 text-blue-500" />}
                        </h2>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.5em] mt-3">
                          {activeTab === 'verified' ? 'PREMIUM AGENT REPOSITORY (PUBLIC ACCESS)' : 'DECENTRALIZED ROBLOX HUB'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-80">
                          <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PROTOCOL SEARCH..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black uppercase outline-none focus:border-white/20 transition-all placeholder:text-zinc-700" />
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} isVerifiedTab={activeTab === 'verified'} />)}
                    {filteredAssets.length === 0 && (
                        <div className="col-span-full py-40 text-center">
                          <div className={`w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center opacity-20 ${activeTab === 'verified' ? 'bg-blue-600/20 text-blue-500' : 'bg-zinc-900'}`}>
                            <Icons.Model className="w-10 h-10" />
                          </div>
                          <p className="text-zinc-700 font-black uppercase tracking-[0.6em] text-[11px]">
                            {activeTab === 'verified' ? 'AGUARDANDO TRANSMISSÃO DE AGENTES VERIFICADOS' : 'NENHUM REGISTRO NO SETOR ATUAL.'}
                          </p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {currentUser && !currentUser.isBanned && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-10 right-10 bg-white text-black w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[6px] border-black">
            <Icons.Plus className="w-6 h-6" />
          </button>
        )}
      </main>

      {/* Profile Modal */}
      {viewedUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setViewedUser(null)} />
          <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="p-10 border-b border-white/5 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-r from-blue-900/10 via-transparent to-transparent">
                <img src={viewedUser.avatar} className={`w-32 h-32 rounded-3xl border border-white/10 shadow-2xl grayscale hover:grayscale-0 transition-all ${viewedUser.isBanned ? 'border-red-600 shadow-red-900/50' : ''}`} referrerPolicy="no-referrer" />
                <div className="flex-grow">
                   <div className="flex flex-col gap-2 mb-2">
                      <div className="flex items-center gap-4">
                        <h2 className={`text-4xl font-black italic uppercase tracking-tighter leading-none flex items-center gap-2 ${viewedUser.isBanned ? 'text-red-600' : ''}`}>
                          {viewedUser.name}
                          {viewedUser.isVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        {viewedUser.isBanned && <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">TERMINATED</span>}
                        {viewedUser.isVerified && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5"><Icons.Verified className="w-3 h-3" /> Verified Agent</span>}
                      </div>
                   </div>
                   <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-4">
                      <span>{viewedUser.followers.length} Seguidores</span>
                      <span>{viewedUser.following.length} Seguindo</span>
                      <span>{userAssets.length} Assets</span>
                   </div>
                </div>
                <div className="flex flex-col gap-3">
                  {isAdmin(currentUser) && (
                    <button onClick={() => handleAdminUserAction(viewedUser.id, 'ban')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewedUser.isBanned ? 'bg-white text-black' : 'bg-red-600 text-white'}`}>
                      {viewedUser.isBanned ? 'Restore Access' : 'Ban Agent'}
                    </button>
                  )}
                </div>
             </div>
             <div className="p-10 overflow-y-auto custom-scrollbar flex-grow">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-8 italic">Agent Repositories</h3>
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
            <div className="lg:w-3/5 p-10 overflow-y-auto custom-scrollbar border-r border-white/5">
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black mb-10 border border-white/10 relative">
                <video ref={detailVideoRef} src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter flex items-center gap-3">
                {selectedAsset.title}
                {selectedAsset.authorVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
              </h2>
              <p className="text-zinc-400 mt-8 text-sm bg-white/[0.02] p-6 rounded-[1.5rem] italic leading-relaxed whitespace-pre-wrap">"{selectedAsset.description}"</p>
            </div>
            <div className="lg:w-2/5 p-10 flex flex-col justify-between bg-black/40">
              <div className="space-y-8">
                <div className="p-6 bg-white/[0.04] rounded-[2rem] border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all group" onClick={() => openUserProfile(selectedAsset.userId)}>
                  <img src={selectedAsset.authorAvatar} className="w-14 h-14 rounded-xl grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-black uppercase flex items-center gap-2 truncate">
                      {selectedAsset.authorName}
                      {selectedAsset.authorVerified && <Icons.Verified className="w-4 h-4 text-blue-500" />}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-3xl bg-white text-black font-black uppercase text-[11px] shadow-2xl active:scale-95 flex items-center justify-center gap-3"><Icons.Download className="w-4 h-4" /> ADQUIRIR FILE</button>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[9px] font-black uppercase text-zinc-700 hover:text-white transition-colors tracking-[0.4em] mt-8">VOLTAR AO SETOR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
