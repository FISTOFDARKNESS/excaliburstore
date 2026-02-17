
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

// Sub-componente para gerenciar a lógica de hover individual de cada card
const AssetCard = ({ asset, currentUser, onClick }: { asset: Asset, currentUser: User | null, onClick: () => void }) => {
  const [showVideo, setShowVideo] = useState(false);
  const hoverTimer = useRef<any>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => {
      setShowVideo(true);
    }, 1200); // 1.2 segundos para iniciar o vídeo
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowVideo(false);
  };

  return (
    <div 
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="premium-card group rounded-[1.5rem] overflow-hidden cursor-pointer border border-white/5 flex flex-col h-[380px] relative"
    >
      <div className="h-[200px] w-full relative overflow-hidden bg-zinc-900 flex items-center justify-center">
        {/* Indicador de Denúncia */}
        {asset.reports > 0 && (
          <div className="absolute top-4 right-4 bg-red-600/80 backdrop-blur-md p-1.5 rounded-lg border border-red-500/50 text-white z-20 shadow-lg animate-pulse">
            <Icons.Report />
          </div>
        )}
        
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[7px] font-black tracking-widest border border-white/10 uppercase shadow-xl z-20">
           ID: {asset.id.split('-').pop()}
        </div>
        
        {/* Thumbnail com Fade Out */}
        <img 
          src={`${asset.thumbnailUrl}?t=${asset.timestamp}`} 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-0' : 'opacity-100'} group-hover:scale-110`}
          alt={asset.title}
          onLoad={(e) => (e.currentTarget.style.opacity = showVideo ? '0' : '1')}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const originalUrl = asset.thumbnailUrl;
            setTimeout(() => { if (target && originalUrl) target.src = `${originalUrl}?t=${Date.now()}`; }, 5000);
          }}
        />

        {/* Video Preview com Fade In */}
        {showVideo && asset.videoUrl && (
          <video 
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
        <div className="overflow-hidden">
          <h3 className="text-xl font-black uppercase italic truncate mb-1">{asset.title}</h3>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Type: {asset.fileType}</p>
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

const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Decode failed", e);
    return null;
  }
};

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'market' | 'profile'>('explore');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStep, setUploadStep] = useState(0);

  const syncRegistry = useCallback(async () => {
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error("Sync error:", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await syncRegistry();
      const session = localStorage.getItem('ex_session');
      if (session) {
        try {
          setCurrentUser(JSON.parse(session));
        } catch(e) {
          localStorage.removeItem('ex_session');
        }
      }
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  useEffect(() => {
    if (currentUser) return;
    let interval: any;
    const tryRender = () => {
      const btn = document.getElementById('google-login-btn');
      if (window.google?.accounts?.id && btn) {
        window.google.accounts.id.initialize({
          client_id: "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com",
          callback: (response: any) => {
            const payload = decodeJWT(response.credential);
            if (payload) {
              const user: User = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                avatar: payload.picture,
                joinedAt: Date.now()
              };
              setCurrentUser(user);
              localStorage.setItem('ex_session', JSON.stringify(user));
            }
          },
        });
        window.google.accounts.id.renderButton(btn, {
          theme: 'filled_black', size: 'large', shape: 'pill', width: '200'
        });
        clearInterval(interval);
      }
    };
    interval = setInterval(tryRender, 500);
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ex_session');
    window.location.reload();
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
    } catch (e) {
      alert("Falha ao enviar denúncia");
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm("TEM CERTEZA QUE DESEJA ELIMINAR ESTE ASSET? Esta ação é irreversível e removerá todos os binários do servidor.")) return;
    setLoading(true);
    try {
      await githubStorage.removeAsset(assetId);
      await syncRegistry();
      setSelectedAsset(null);
      alert("Asset removido com sucesso.");
    } catch (e) {
      alert("Falha ao remover asset.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login necessário");
    window.open(asset.fileUrl, '_blank');
    try {
      const updated = await githubStorage.incrementDownload(asset.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    } catch (e) { console.error(e); }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return alert("Login obrigatório.");
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;
    if (!assetFile || !thumbFile || !videoFile) return alert("Todos os arquivos são obrigatórios.");
    
    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress('IA: Analisando e gerando tags semânticas...');
    
    try {
      const title = formData.get('title') as string;
      const desc = formData.get('desc') as string;
      const keywords = await generateKeywords(title, desc);
      
      setUploadStep(2);
      setUploadProgress('Preparando transmissão criptografada...');
      
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const uniqueId = `EXC-${timestamp}-${randomStr}`;
      
      const newAsset: Asset = {
        id: uniqueId, userId: currentUser.id, authorName: currentUser.name, authorAvatar: currentUser.avatar,
        title, originalFileName: assetFile.name, description: desc, category: formData.get('category') as Category,
        thumbnailUrl: '', fileUrl: '', videoUrl: '',
        fileType: assetFile.name.slice(assetFile.name.lastIndexOf('.')) as RobloxFileType,
        downloadCount: 0, likes: [], reports: 0, credits: formData.get('credits') as string,
        comments: [], timestamp: Date.now(), keywords
      };

      await githubStorage.uploadAsset(newAsset, { asset: assetFile, thumb: thumbFile, video: videoFile }, (msg) => {
        setUploadProgress(msg);
        setUploadStep(prev => Math.min(prev + 1, 6));
      });
      
      setUploadStep(6);
      setUploadProgress('Upload concluído com sucesso.');
      setTimeout(() => {
        setShowUpload(false);
        setIsUploading(false);
        setUploadStep(0);
        syncRegistry();
      }, 800);
      
    } catch (err: any) {
      alert("Erro no Upload: " + err.message);
      setIsUploading(false);
      setUploadStep(0);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) list = list.filter(a => a.userId === currentUser.id);
    const q = searchQuery.toLowerCase();
    if (!q) return list;
    return list.filter(a => 
      a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) ||
      a.keywords?.some(k => k.toLowerCase().includes(q)) || a.id.toLowerCase().includes(q)
    );
  }, [assets, searchQuery, activeTab, currentUser]);

  const isOwnerOrAdmin = (asset: Asset) => {
    if (!currentUser) return false;
    return currentUser.id === asset.userId || ADMIN_EMAILS.includes(currentUser.email);
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-black">
      <div className="text-white font-black text-[9px] uppercase tracking-[1.2em] animate-pulse">EXCALIBUR OS // PROCESSING</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 border-r border-white/5 flex flex-col p-6 lg:fixed h-auto lg:h-full z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(255,255,255,0.15)]"><Icons.Model /></div>
          <h1 className="font-black italic text-lg tracking-tighter">EXCALIBUR</h1>
        </div>
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-4 lg:pb-0">
          {['explore', 'market', 'profile'].map(id => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`flex items-center gap-3 p-3.5 rounded-xl transition-all font-bold text-[9px] uppercase tracking-widest ${activeTab === id ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
              {id === 'explore' ? <Icons.Search /> : id === 'market' ? <Icons.Script /> : <Icons.Plus />}
              <span>{id}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5">
          {currentUser ? (
            <div className="group relative">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                <img src={currentUser.avatar} className="w-7 h-7 rounded-lg grayscale group-hover:grayscale-0 transition-all shadow-md" referrerPolicy="no-referrer" />
                <div className="min-w-0"><p className="text-[9px] font-black truncate">{currentUser.name}</p></div>
              </div>
              <button onClick={handleLogout} className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 bg-red-600/90 rounded-xl flex items-center justify-center text-[9px] font-black uppercase transition-all z-10 shadow-lg">Desconectar</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 items-center justify-center min-h-[120px]">
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Protocolo de Login</p>
              <div id="google-login-btn" className="w-full flex justify-center scale-90"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-64 p-6 lg:p-12">
        <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col">
             <h2 className="text-4xl lg:text-5xl font-black italic tracking-tighter uppercase leading-none">{activeTab}</h2>
             <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Unique Roblox Repository</p>
          </div>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="BUSCAR POR ID OU PROTOCOLO..." className="w-full md:w-64 bg-zinc-900 border border-white/5 rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-white/20 transition-colors" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredAssets.map(asset => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              currentUser={currentUser} 
              onClick={() => setSelectedAsset(asset)} 
            />
          ))}
          {filteredAssets.length === 0 && (
            <div className="col-span-full py-24 text-center opacity-40">
              <p className="text-zinc-600 font-black uppercase tracking-[0.5em] text-[10px]">Nenhum registro no setor.</p>
            </div>
          )}
        </div>

        {currentUser && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-10 right-10 bg-white text-black w-16 h-16 rounded-2xl shadow-[0_15px_45px_rgba(255,255,255,0.1)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[6px] border-black">
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-2xl bg-[#080808] border border-white/10 rounded-[2.5rem] p-10 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h2 className="text-3xl font-black italic uppercase mb-10 tracking-tighter">Transmissão</h2>
            
            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-10 animate-in fade-in zoom-in duration-500">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                  <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  <div className="text-[10px] font-black uppercase text-white animate-pulse">TX-{Math.floor(Math.random()*900)+100}</div>
                </div>
                
                <div className="w-full max-w-md space-y-4">
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500">
                    <span>Progresso de Transmissão</span>
                    <span>{Math.round((uploadStep / 6) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                      style={{ width: `${(uploadStep / 6) * 100}%` }}
                    />
                  </div>
                  <p className="text-center text-[10px] font-black uppercase italic text-zinc-300 tracking-[0.2em] pt-2 animate-pulse">
                    {uploadProgress}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <input required name="title" placeholder="IDENTIFICAÇÃO DO ASSET" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 text-[10px] font-black uppercase outline-none focus:border-white/20 transition-all" />
                <textarea required name="desc" placeholder="ESPECIFICAÇÕES TÉCNICAS" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 h-32 resize-none text-[10px] font-black uppercase outline-none focus:border-white/20 transition-all" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-600 ml-1">Binário</label>
                    <input required name="file" type="file" accept=".rbxm,.rbxl" className="bg-zinc-900 p-3.5 rounded-xl text-[8px] text-zinc-400 border border-white/5 file:hidden cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-600 ml-1">Classificação</label>
                    <select name="category" className="bg-zinc-900 p-3.5 rounded-xl text-[9px] uppercase font-black outline-none border border-white/5 cursor-pointer">
                      {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-600 ml-1">Showcase MP4</label>
                    <input required name="video" type="file" accept="video/mp4" className="bg-zinc-900 p-3.5 rounded-xl text-[8px] text-zinc-400 border border-white/5 file:hidden cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-600 ml-1">Visual PNG/JPG</label>
                    <input required name="thumb" type="file" accept="image/*" className="bg-zinc-900 p-3.5 rounded-xl text-[8px] text-zinc-400 border border-white/5 file:hidden cursor-pointer" />
                  </div>
                </div>
                <input required name="credits" placeholder="CREDENCIAIS" className="w-full bg-zinc-900 p-5 rounded-xl text-[10px] font-black uppercase outline-none border border-white/5 transition-all" />
                <button type="submit" className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-zinc-200 transition-all shadow-xl active:scale-95">
                  Iniciar Protocolo de Transmissão
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Asset Detail View */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-5xl bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col lg:flex-row max-h-[85vh] shadow-2xl">
            <div className="lg:w-3/5 p-10 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-white/5">
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black mb-10 border border-white/10 shadow-2xl relative">
                {selectedAsset.videoUrl ? (
                  <video 
                    src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} 
                    autoPlay muted loop playsInline 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      const videoElement = e.target as HTMLVideoElement;
                      const videoUrl = selectedAsset.videoUrl;
                      setTimeout(() => { if (videoElement && videoUrl) videoElement.src = `${videoUrl}?t=${Date.now()}`; }, 5000);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-[9px] font-black text-zinc-600 uppercase">Bufferizando...</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex-grow">
                  <div className="flex items-center gap-4">
                    <h2 className="text-3xl lg:text-4xl font-black italic uppercase tracking-tighter leading-none">{selectedAsset.title}</h2>
                    {selectedAsset.reports > 0 && (
                      <span className="flex items-center gap-1.5 bg-red-600/20 text-red-500 border border-red-600/30 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">
                        <Icons.Report /> Sob Revisão ({selectedAsset.reports})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em] bg-white/[0.03] px-3 py-1 rounded-lg border border-white/5">UUID: {selectedAsset.id}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <span className="px-4 py-2 bg-white/5 rounded-xl text-[8px] font-black border border-white/10 uppercase tracking-[0.1em]">{selectedAsset.category}</span>
                   <span className="px-4 py-2 bg-white/5 rounded-xl text-[8px] font-black border border-white/10 uppercase tracking-[0.1em]">{selectedAsset.fileType}</span>
                </div>
              </div>
              <p className="text-zinc-400 mb-10 leading-relaxed text-sm whitespace-pre-wrap bg-white/[0.02] p-6 rounded-[1.5rem] border border-white/5 italic">"{selectedAsset.description}"</p>
            </div>
            <div className="lg:w-2/5 bg-black/60 p-10 flex flex-col justify-between">
              <div className="space-y-8">
                <div className="p-6 bg-white/[0.04] rounded-[2rem] border border-white/5 space-y-6 shadow-xl">
                   <div className="flex items-center gap-4">
                      <img src={selectedAsset.authorAvatar} className="w-12 h-12 rounded-xl grayscale border border-white/10" />
                      <div>
                        <p className="text-[8px] font-black uppercase text-zinc-600 tracking-widest">Provider</p>
                        <p className="text-[14px] font-black uppercase tracking-tighter leading-none">{selectedAsset.authorName}</p>
                      </div>
                   </div>
                   <div className="pt-6 border-t border-white/5">
                      <p className="text-[8px] font-black uppercase text-zinc-600 mb-1 tracking-widest">Ownership</p>
                      <p className="text-[11px] text-zinc-400 italic leading-snug">{selectedAsset.credits}</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white/[0.04] rounded-[1.5rem] border border-white/5 text-center shadow-lg">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">Downloads</p>
                    <p className="text-2xl font-black tracking-tighter">{selectedAsset.downloadCount}</p>
                  </div>
                  <div className="p-6 bg-white/[0.04] rounded-[1.5rem] border border-white/5 text-center shadow-lg">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1 tracking-widest">Likes</p>
                    <p className="text-2xl font-black tracking-tighter">{selectedAsset.likes?.length || 0}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-[1.5rem] bg-white text-black font-black uppercase text-[10px] hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95">
                    <Icons.Download /> ADQUIRIR FILE
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleLike(selectedAsset.id)} className={`py-6 rounded-[1.5rem] font-black uppercase text-[10px] border border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95 ${selectedAsset.likes?.includes(currentUser?.id || '') ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                       <Icons.Like filled={selectedAsset.likes?.includes(currentUser?.id || '')} />
                       CURTIR
                    </button>
                    <button onClick={() => handleReport(selectedAsset.id)} className="py-6 rounded-[1.5rem] font-black uppercase text-[10px] border border-red-900/30 bg-red-900/10 text-red-500 hover:bg-red-900/20 transition-all flex items-center justify-center gap-3 active:scale-95">
                       <Icons.Report /> DENUNCIAR
                    </button>
                  </div>
                  {isOwnerOrAdmin(selectedAsset) && (
                    <button onClick={() => handleDelete(selectedAsset.id)} className="w-full py-5 rounded-[1.5rem] font-black uppercase text-[9px] border border-red-600 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95">
                      ELIMINAR ASSET (PROPRIETÁRIO/ADMIN)
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[9px] font-black uppercase text-zinc-800 hover:text-white transition-colors mt-8 tracking-[0.3em]">Encerrar Sessão</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
