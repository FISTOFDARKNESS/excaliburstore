
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, RobloxFileType, Comment } from './types';
import { Icons } from './constants';
import { githubStorage } from './services/githubService';
import { generateKeywords } from './services/geminiService';

declare global {
  interface Window {
    google: any;
  }
}

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
      if (session) setCurrentUser(JSON.parse(session));
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  // Google Login - Lógica de renderização forçada
  useEffect(() => {
    if (currentUser || loading) return;

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
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: '240'
        });
        clearInterval(interval);
      }
    };

    // Tenta renderizar o botão a cada 500ms até que o DOM e o script estejam prontos
    interval = setInterval(tryRender, 500);

    // Carrega o script se não existir
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => clearInterval(interval);
  }, [currentUser, loading]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ex_session');
    // Forçar limpeza completa para resetar o estado do login
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
    setUploadProgress('IA: Gerando metadados...');

    try {
      const title = formData.get('title') as string;
      const desc = formData.get('desc') as string;
      const keywords = await generateKeywords(title, desc);
      
      setUploadProgress('Fazendo upload...');

      // Gerador de ID único robusto
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const uniqueId = `EXC-${timestamp}-${randomStr}`;

      const newAsset: Asset = {
        id: uniqueId,
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: title,
        originalFileName: assetFile.name,
        description: desc,
        category: formData.get('category') as Category,
        thumbnailUrl: '',
        fileUrl: '',
        videoUrl: '',
        fileType: assetFile.name.slice(assetFile.name.lastIndexOf('.')) as RobloxFileType,
        downloadCount: 0,
        likes: [],
        reports: 0,
        credits: formData.get('credits') as string,
        comments: [],
        timestamp: Date.now(),
        keywords: keywords
      };

      await githubStorage.uploadAsset(newAsset, { asset: assetFile, thumb: thumbFile, video: videoFile });
      setShowUpload(false);
      setIsUploading(false);
      await syncRegistry();
    } catch (err: any) {
      alert("Erro no Upload: " + err.message);
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) list = list.filter(a => a.userId === currentUser.id);
    const q = searchQuery.toLowerCase();
    if (!q) return list;
    return list.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.description.toLowerCase().includes(q) ||
      a.keywords?.some(k => k.toLowerCase().includes(q)) ||
      a.id.toLowerCase().includes(q)
    );
  }, [assets, searchQuery, activeTab, currentUser]);

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-black">
      <div className="text-white font-black text-xs uppercase tracking-[1em] animate-pulse">
        Excalibur OS // Loading
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      <aside className="w-full lg:w-72 border-r border-white/5 flex flex-col p-8 lg:fixed h-auto lg:h-full z-50 bg-[#050505]">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center rotate-3"><Icons.Model /></div>
          <h1 className="font-black italic text-xl tracking-tighter">EXCALIBUR</h1>
        </div>

        <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0">
          {[
            { id: 'explore', icon: <Icons.Search /> },
            { id: 'market', icon: <Icons.Script /> },
            { id: 'profile', icon: <Icons.Plus /> }
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id as any)} 
              className={`flex items-center gap-4 p-4 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest ${activeTab === item.id ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon}
              <span>{item.id}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="group relative">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-lg grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="min-w-0"><p className="text-[10px] font-black truncate">{currentUser.name}</p></div>
              </div>
              <button onClick={handleLogout} className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 bg-red-600/90 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase transition-all z-10">Desconectar</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 items-center justify-center min-h-[100px]">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] text-center">Auth Required</p>
              <div id="google-login-btn" className="w-full flex justify-center"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-72 p-6 lg:p-16">
        <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="flex flex-col">
             <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter uppercase leading-none">{activeTab}</h2>
             <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.5em] mt-2">Roblox File Marketplace</p>
          </div>
          <input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="ID OU TERMO..." 
            className="w-full md:w-auto bg-zinc-900 border border-white/5 rounded-2xl py-4 px-8 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-white/20" 
          />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredAssets.map(asset => (
            <div key={asset.id} onClick={() => setSelectedAsset(asset)} className="premium-card group rounded-3xl overflow-hidden cursor-pointer border border-white/5 flex flex-col h-[420px]">
              <div className="h-2/3 relative overflow-hidden bg-zinc-900">
                <img src={asset.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={asset.title} />
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg text-[7px] font-black tracking-widest border border-white/10 uppercase">
                   Serial: {asset.id.split('-').pop()}
                </div>
              </div>
              <div className="p-6 flex flex-col justify-between flex-grow bg-gradient-to-b from-transparent to-black/20">
                <div>
                  <h3 className="text-xl font-black uppercase italic truncate mb-1">{asset.title}</h3>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Type: {asset.fileType}</p>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-4 border-t border-white/5">
                  <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/5">{asset.category}</span>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} /> {asset.likes?.length || 0}</span>
                    <span className="flex items-center gap-1"><Icons.Download /> {asset.downloadCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentUser && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-12 right-12 bg-white text-black w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-black">
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-3xl bg-[#080808] border border-white/10 rounded-[2.5rem] p-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black italic uppercase mb-12 tracking-tighter">Protocolo de Upload</h2>
            <div className="space-y-8">
              <input required name="title" placeholder="NOME DO ASSET" className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-5 text-[11px] font-black uppercase outline-none focus:border-white/20" />
              <textarea required name="desc" placeholder="ESPECIFICAÇÕES TÉCNICAS" className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-5 h-32 resize-none text-[11px] font-black uppercase outline-none focus:border-white/20" />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600">Arquivo (.rbxm/.rbxl)</label>
                  <input required name="file" type="file" accept=".rbxm,.rbxl" className="bg-zinc-900 p-3 rounded-xl text-[8px] text-zinc-400 border border-white/5" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600">Categoria</label>
                  <select name="category" className="bg-zinc-900 p-3 rounded-xl text-[9px] uppercase font-black outline-none border border-white/5">
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600">Showcase MP4</label>
                  <input required name="video" type="file" accept="video/mp4" className="bg-zinc-900 p-3 rounded-xl text-[8px] text-zinc-400 border border-white/5" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600">Thumbnail PNG/JPG</label>
                  <input required name="thumb" type="file" accept="image/*" className="bg-zinc-900 p-3 rounded-xl text-[8px] text-zinc-400 border border-white/5" />
                </div>
              </div>
              <input required name="credits" placeholder="CRÉDITOS / AUTORIA" className="w-full bg-zinc-900 p-5 rounded-2xl text-[10px] font-black uppercase outline-none border border-white/5" />
              <button disabled={isUploading} className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50">
                {isUploading ? uploadProgress : 'Sincronizar com Repositório'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unique View Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-6xl bg-[#080808] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
            <div className="lg:w-2/3 p-12 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-white/5">
              <div className="aspect-video rounded-3xl overflow-hidden bg-black mb-12 border border-white/10 shadow-2xl">
                <video src={selectedAsset.videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-4xl lg:text-5xl font-black italic uppercase tracking-tighter leading-none">{selectedAsset.title}</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-2">UUID: {selectedAsset.id}</p>
                </div>
                <div className="flex gap-2">
                   <span className="px-4 py-2 bg-white/5 rounded-xl text-[9px] font-black border border-white/10 uppercase">{selectedAsset.category}</span>
                   <span className="px-4 py-2 bg-white/5 rounded-xl text-[9px] font-black border border-white/10 uppercase">{selectedAsset.fileType}</span>
                </div>
              </div>
              <p className="text-zinc-400 mb-12 leading-relaxed text-sm whitespace-pre-wrap bg-white/2 p-6 rounded-2xl border border-white/5">{selectedAsset.description}</p>
              
              <div className="flex flex-wrap gap-2">
                {selectedAsset.keywords?.map(k => (
                  <span key={k} className="text-[8px] font-black uppercase tracking-widest bg-zinc-900 text-zinc-500 px-4 py-2 rounded-xl border border-white/5">#{k}</span>
                ))}
              </div>
            </div>
            <div className="lg:w-1/3 bg-black/40 p-12 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-4">
                      <img src={selectedAsset.authorAvatar} className="w-10 h-10 rounded-xl grayscale shadow-lg" />
                      <div>
                        <p className="text-[8px] font-black uppercase text-zinc-600">Developer</p>
                        <p className="text-[12px] font-black uppercase">{selectedAsset.authorName}</p>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-white/5">
                      <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Credits</p>
                      <p className="text-[10px] text-zinc-400 italic">{selectedAsset.credits}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Downloads</p>
                    <p className="text-xl font-black">{selectedAsset.downloadCount}</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Appreciation</p>
                    <p className="text-xl font-black">{selectedAsset.likes?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-2xl bg-white text-black font-black uppercase text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-3">
                    <Icons.Download /> ADQUIRIR FILE
                  </button>
                  <button onClick={() => handleLike(selectedAsset.id)} className={`w-full py-6 rounded-2xl font-black uppercase text-xs border border-white/10 transition-all flex items-center justify-center gap-3 ${selectedAsset.likes?.includes(currentUser?.id || '') ? 'bg-blue-600 text-white' : 'bg-white/5 text-white'}`}>
                     <Icons.Like filled={selectedAsset.likes?.includes(currentUser?.id || '')} />
                     {selectedAsset.likes?.includes(currentUser?.id || '') ? 'RECONHECIDO' : 'DAR RECONHECIMENTO'}
                  </button>
                </div>
              </div>

              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[10px] font-black uppercase text-zinc-600 hover:text-white transition-colors mt-8">Encerrar Sessão</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
