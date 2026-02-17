
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
      className={`premium-card group rounded-[1.5rem] overflow-hidden cursor-pointer flex flex-col h-[380px] relative ${asset.reports > 5 ? 'opacity-50 grayscale' : 'opacity-100'}`}
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
            className="absolute inset-0 w-full h-full object-cover animate-fade-in" 
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
          <span className="px-3 py-1 rounded-md border bg-white/5 border-white/5">{asset.category}</span>
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

  const handleDelete = async (assetId: string) => {
    if (!isAdmin(currentUser)) return;
    if (!confirm("CONFIRMAR PURGA: Esta ação removerá permanentemente o asset do repositório. Continuar?")) return;
    
    setLoading(true);
    try {
      await githubStorage.removeAsset(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      if (selectedAsset?.id === assetId) setSelectedAsset(null);
      alert("Asset removido com sucesso.");
    } catch (e: any) {
      alert("ERRO AO REMOVER ASSET: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login necessário para adquirir files.");
    window.open(asset.fileUrl, '_blank');
    const updated = await githubStorage.incrementDownload(asset.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
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

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;

    if (!assetFile || !thumbFile || !videoFile) {
        return alert("PROTOCOL ERROR: Todos os arquivos (Asset, Thumb, Video) são obrigatórios.");
    }

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
      alert("TRANSMISSÃO COMPLETA: O asset já está disponível no marketplace.");
    } catch (err) {
      alert("ERRO NA TRANSMISSÃO: Verifique a conexão e tente novamente.");
      setIsUploading(false);
    }
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

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-brand-black text-[10px] font-black uppercase tracking-[1em] animate-pulse">EXCALIBUR OS // PROCESSING</div>;

  return (
    <div className="min-h-screen bg-brand-black text-brand-white flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 border-r border-white/5 flex flex-col p-6 lg:fixed h-auto lg:h-full z-50 bg-brand-black shrink-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-brand-white rounded-lg flex items-center justify-center rotate-3 shadow-lg shadow-white/5"><Icons.Model className="w-5 h-5 text-black" /></div>
          <h1 className="font-black italic text-lg tracking-tighter">EXCALIBUR</h1>
        </div>
        <nav className="flex flex-col gap-1.5 pb-4">
          <button onClick={() => setActiveTab('explore')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'explore' ? 'bg-brand-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Search className="w-5 h-5" />
             <span>EXPLORE</span>
          </button>
          
          <button onClick={() => setActiveTab('verified')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'verified' ? 'bg-brand-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Verified className={`w-5 h-5 ${activeTab === 'verified' ? 'text-black' : 'text-blue-500'}`} />
             <span>VERIFIED</span>
          </button>
          
          <button onClick={() => setActiveTab('market')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'market' ? 'bg-brand-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
             <Icons.Script className="w-5 h-5" />
             <span>MARKET</span>
          </button>
          
          <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-4 p-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-brand-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
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
                <img src={currentUser.avatar} className="w-8 h-8 rounded-lg grayscale group-hover:grayscale-0 transition-all border border-white/10" referrerPolicy="no-referrer" />
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
            <div className="animate-fade-in">
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
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${adminSubTab === tab ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </header>
                
                {adminSubTab === 'reports' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {reportedAssets.map(asset => (
                            <div key={asset.id} className="bg-zinc-950 border border-red-500/20 rounded-2xl overflow-hidden p-6 relative">
                                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{asset.reports} REPORTS</div>
                                <h3 className="text-lg font-black uppercase italic mb-2">{asset.title}</h3>
                                <p className="text-[9px] text-zinc-500 uppercase mb-4">By: {asset.authorName} (ID: {asset.id})</p>
                                <div className="flex gap-2 mt-auto">
                                    <button onClick={() => setSelectedAsset(asset)} className="flex-grow bg-white/5 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-white/10 transition-colors">Inspect</button>
                                    <button onClick={() => handleDelete(asset.id)} className="flex-grow bg-red-600 py-2 rounded-lg text-[9px] font-black uppercase text-white shadow-lg shadow-red-600/20">Purge Asset</button>
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
                                className="w-full bg-zinc-950 border border-white/5 rounded-xl py-4 px-6 text-[10px] font-black uppercase outline-none focus:border-red-600/50 transition-all placeholder:text-zinc-800"
                            />
                        </div>
                        <div className="bg-zinc-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
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
                                                    <img src={u.avatar} className={`w-8 h-8 rounded-lg border border-white/10 ${u.isBanned ? 'grayscale opacity-30' : ''}`} referrerPolicy="no-referrer" />
                                                    <div>
                                                        <p className={`flex items-center gap-1.5 text-[11px] italic ${u.isBanned ? 'line-through text-zinc-700' : ''}`}>
                                                            {u.name} {u.isVerified && <Icons.Verified className="w-3 h-3 text-blue-500" />}
                                                        </p>
                                                        <p className="text-[7px] text-zinc-600 lowercase">{u.email}</p>
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
                                                    <button onClick={() => handleAdminUserAction(u.id, u.isVerified ? 'unverify' : 'verify')} className={`px-3 py-1.5 rounded-lg transition-all ${u.isVerified ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-600 text-white'}`}>{u.isVerified ? 'REVOKE' : 'VERIFY'}</button>
                                                    <button onClick={() => handleAdminUserAction(u.id, 'ban')} className={`px-3 py-1.5 rounded-lg font-black transition-all ${u.isBanned ? 'bg-brand-white text-black' : 'bg-red-600 text-white'}`}>{u.isBanned ? 'RESTORE' : 'TERMINATE'}</button>
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
            <div className="animate-fade-in">
                <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
                    <div>
                        <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none flex items-center gap-4 text-brand-white">
                          {activeTab}
                          {activeTab === 'verified' && <Icons.Verified className="w-12 h-12 text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                        </h2>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.5em] mt-3 italic">
                          DECENTRALIZED ROBLOX HUB // PROTOCOL {activeTab.toUpperCase()}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-80">
                          <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PROTOCOL SEARCH..." className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-[11px] font-black uppercase outline-none focus:border-white/20 transition-all placeholder:text-zinc-800" />
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />)}
                    {filteredAssets.length === 0 && (
                        <div className="col-span-full py-40 text-center">
                          <div className="w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center opacity-20 bg-zinc-900 shadow-inner">
                            <Icons.Model className="w-10 h-10" />
                          </div>
                          <p className="text-zinc-700 font-black uppercase tracking-[0.6em] text-[11px]">
                            NENHUM REGISTRO NO SETOR ATUAL.
                          </p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {currentUser && !currentUser.isBanned && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-10 right-10 bg-brand-white text-black w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[6px] border-brand-black group">
            <Icons.Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        )}
      </main>

      {/* MODAL UPLOAD MELHORADO */}
      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => !isUploading && setShowUpload(false)} />
          <div className="relative w-full max-w-4xl bg-brand-black border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.05)] animate-fade-in flex flex-col max-h-[90vh]">
            
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-950/50">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Transmission Protocol</h2>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Sincronização de Assets com o Repositório Excalibur</p>
              </div>
              {!isUploading && (
                <button onClick={() => setShowUpload(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </header>

            <form onSubmit={handleUpload} className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-10">
              
              {/* Step 1: Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Identificação do Asset</label>
                    <input required name="title" placeholder="EX: ULTRA MODERN HOUSE SYSTEM" className="w-full bg-zinc-950 border border-white/10 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-white/30 transition-all placeholder:text-zinc-800" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Descrição Técnica</label>
                    <textarea required name="desc" placeholder="DETALHE O FUNCIONAMENTO DO SEU ASSET..." className="w-full bg-zinc-950 border border-white/10 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-white/30 transition-all placeholder:text-zinc-800 h-32 resize-none" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Setor / Categoria</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(Category).map(cat => (
                            <label key={cat} className="cursor-pointer">
                                <input type="radio" name="category" value={cat} defaultChecked={cat === Category.MODEL} className="peer hidden" />
                                <div className="p-3 border border-white/5 bg-zinc-950 rounded-xl text-[9px] font-black uppercase text-center text-zinc-600 peer-checked:bg-white peer-checked:text-black transition-all peer-checked:border-white">{cat}</div>
                            </label>
                        ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Créditos de Autoria</label>
                    <input name="credits" placeholder="EX: @ROBLOX_DEV / ASSET STORE" className="w-full bg-zinc-950 border border-white/10 rounded-xl py-4 px-6 text-[11px] font-black uppercase outline-none focus:border-white/30 transition-all placeholder:text-zinc-800" />
                  </div>
                </div>
              </div>

              {/* Step 2: Arquivos de Mídia */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* File .rbxm */}
                <div className="group relative">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Protocolo File (.rbxm/.rbxl)</label>
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-3xl bg-zinc-950/50 hover:bg-white/[0.02] hover:border-white/20 transition-all cursor-pointer">
                    <Icons.Script className="w-8 h-8 text-zinc-700 group-hover:text-white transition-colors mb-3" />
                    <span className="text-[9px] font-black uppercase text-zinc-600">Click to Sync File</span>
                    <input required type="file" name="file" accept=".rbxm,.rbxl,.rbxmx" className="hidden" />
                  </label>
                </div>

                {/* Thumbnail */}
                <div className="group relative">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Static Thumbnail (PNG/JPG)</label>
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-3xl bg-zinc-950/50 hover:bg-white/[0.02] hover:border-white/20 transition-all cursor-pointer">
                    <svg className="w-8 h-8 text-zinc-700 group-hover:text-white transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[9px] font-black uppercase text-zinc-600">Visual Interface</span>
                    <input required type="file" name="thumb" accept="image/*" className="hidden" />
                  </label>
                </div>

                {/* Video */}
                <div className="group relative">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block italic">Dynamic Preview (MP4)</label>
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-3xl bg-zinc-950/50 hover:bg-white/[0.02] hover:border-white/20 transition-all cursor-pointer">
                    <svg className="w-8 h-8 text-zinc-700 group-hover:text-white transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="text-[9px] font-black uppercase text-zinc-600">Showcase Stream</span>
                    <input required type="file" name="video" accept="video/mp4" className="hidden" />
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-end gap-4">
                 {!isUploading && (
                   <>
                    <button type="button" onClick={() => setShowUpload(false)} className="px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">Abort</button>
                    <button type="submit" className="px-12 py-5 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-zinc-200 transition-all active:scale-95">Inicia Transmissão</button>
                   </>
                 )}
              </div>
            </form>

            {/* Overlay de Progresso de Transmissão */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-12 z-50 text-center animate-fade-in">
                <div className="w-24 h-24 mb-10 relative">
                   <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                   <div className="absolute inset-0 border-4 border-white rounded-full border-t-transparent animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center font-black italic text-xl">
                      {Math.round((uploadStep / 6) * 100)}%
                   </div>
                </div>
                <h3 className="text-2xl font-black italic uppercase mb-4 tracking-tighter">Sincronizando com o Mainframe</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] max-w-sm mb-12">{uploadProgress}</p>
                
                {/* Visualizer do Step */}
                <div className="flex gap-2 w-full max-w-xs h-1">
                   {[1,2,3,4,5,6].map(i => (
                     <div key={i} className={`flex-grow rounded-full transition-all duration-700 ${i <= uploadStep ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/10'}`} />
                   ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Profile / Detail Views mantidos */}
      {viewedUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setViewedUser(null)} />
          <div className="relative w-full max-w-4xl bg-brand-black border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-fade-in">
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
                        {viewedUser.isBanned && <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20">TERMINATED</span>}
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
                    <button onClick={() => handleAdminUserAction(viewedUser.id, 'ban')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg ${viewedUser.isBanned ? 'bg-brand-white text-black' : 'bg-red-600 text-white shadow-red-600/20'}`}>
                      {viewedUser.isBanned ? 'Restore Access' : 'Ban Agent'}
                    </button>
                  )}
                </div>
             </div>
             <div className="p-10 overflow-y-auto custom-scrollbar flex-grow">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-8 italic">Agent Repositories</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userAssets.map(asset => (
                    <div key={asset.id} onClick={() => { setSelectedAsset(asset); setViewedUser(null); }} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 hover:border-white/10 transition-all group">
                       <img src={asset.thumbnailUrl} className="w-16 h-16 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all border border-white/10" />
                       <div className="min-w-0">
                          <p className="font-black uppercase text-[12px] truncate group-hover:italic transition-all">{asset.title}</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">{asset.category} • {asset.downloadCount} DL</p>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-5xl bg-brand-black border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col lg:flex-row max-h-[85vh] shadow-2xl animate-fade-in">
            <div className="lg:w-3/5 p-10 overflow-y-auto custom-scrollbar border-r border-white/5">
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-zinc-950 mb-10 border border-white/10 relative group">
                <video ref={detailVideoRef} src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter flex items-center gap-3">
                {selectedAsset.title}
                {selectedAsset.authorVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
              </h2>
              <p className="text-zinc-400 mt-8 text-sm bg-white/[0.02] p-6 rounded-[1.5rem] italic leading-relaxed whitespace-pre-wrap border border-white/5">"{selectedAsset.description}"</p>
            </div>
            <div className="lg:w-2/5 p-10 flex flex-col justify-between bg-zinc-950/40">
              <div className="space-y-8">
                <div className="p-6 bg-white/[0.04] rounded-[2rem] border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/10 hover:border-white/10 transition-all group" onClick={() => openUserProfile(selectedAsset.userId)}>
                  <img src={selectedAsset.authorAvatar} className="w-14 h-14 rounded-xl grayscale group-hover:grayscale-0 transition-all border border-white/10 shadow-lg" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-black uppercase flex items-center gap-2 truncate group-hover:italic transition-all">
                      {selectedAsset.authorName}
                      {selectedAsset.authorVerified && <Icons.Verified className="w-4 h-4 text-blue-500" />}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">Verified Creator</p>
                  </div>
                </div>
                <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-3xl bg-brand-white text-black font-black uppercase text-[11px] shadow-2xl active:scale-95 flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors"><Icons.Download className="w-4 h-4" /> ADQUIRIR FILE</button>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[9px] font-black uppercase text-zinc-700 hover:text-brand-white transition-colors tracking-[0.4em] mt-8">VOLTAR AO SETOR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
