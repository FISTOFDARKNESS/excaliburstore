
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, RobloxFileType, Comment } from './types';
import { Icons } from './constants';
import { githubStorage } from './services/githubService';
import { generateKeywords } from './services/geminiService';

declare global {
  interface Window {
    handleGoogleLogin: (response: any) => void;
  }
}

// Safer base64url decoding for Google JWT
const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
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
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    window.handleGoogleLogin = (response: any) => {
      const event = new CustomEvent('google-login', { detail: response });
      window.dispatchEvent(event);
    };
  }, []);

  const syncRegistry = useCallback(async () => {
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error("Failed to sync registry", e);
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

  useEffect(() => {
    const handleLoginEvent = (e: any) => {
      const response = e.detail;
      const payload = decodeJWT(response.credential);
      if (!payload) return alert("Falha ao processar login do Google.");

      const user: User = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        avatar: payload.picture,
        joinedAt: Date.now()
      };
      setCurrentUser(user);
      localStorage.setItem('ex_session', JSON.stringify(user));
    };
    window.addEventListener('google-login', handleLoginEvent as any);
    return () => window.removeEventListener('google-login', handleLoginEvent as any);
  }, []);

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

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login necessário");
    window.open(asset.fileUrl, '_blank');
    try {
      const updated = await githubStorage.incrementDownload(asset.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedAsset || !commentText.trim()) return;
    
    const newComment: Comment = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text: commentText,
      timestamp: Date.now()
    };

    try {
      const updated = await githubStorage.addComment(selectedAsset.id, newComment);
      setSelectedAsset(updated);
      setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
      setCommentText('');
    } catch (e) { alert("Erro ao comentar"); }
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

    const title = formData.get('title') as string;
    const desc = formData.get('desc') as string;
    const assetId = crypto.randomUUID();
    
    try {
      const keywords = await generateKeywords(title, desc);
      setUploadProgress('Sincronizando com GitHub...');

      const newAsset: Asset = {
        id: assetId,
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
    } catch (err) {
      alert("Erro no Upload: " + (err as Error).message);
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) {
      list = list.filter(a => a.userId === currentUser.id);
    }
    const q = searchQuery.toLowerCase();
    if (!q) return list;
    return list.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.description.toLowerCase().includes(q) ||
      a.keywords?.some(k => k.toLowerCase().includes(q))
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
      <div 
        id="g_id_onload"
        data-client_id="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
        data-context="signin"
        data-ux_mode="popup"
        data-callback="handleGoogleLogin"
        data-auto_prompt="false"
      ></div>

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

        <div className="mt-auto pt-8">
          {currentUser ? (
            <div className="group relative">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-lg grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="min-w-0"><p className="text-[10px] font-black truncate">{currentUser.name}</p></div>
              </div>
              <button onClick={handleLogout} className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 bg-red-600/90 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase transition-all z-10">Sair</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-center">Acesse sua conta</p>
              <div className="g_id_signin" data-type="standard" data-theme="filled_black" data-size="large" data-width="100%" data-shape="pill"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-72 p-6 lg:p-16">
        <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter uppercase leading-none">{activeTab}</h2>
          <input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="BUSCAR ASSETS..." 
            className="w-full md:w-auto bg-zinc-900 border border-white/5 rounded-2xl py-4 px-8 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-white/20" 
          />
        </header>

        {filteredAssets.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/5 rounded-[3rem]">
            <p className="text-zinc-600 font-black text-xs uppercase tracking-widest">Nenhum asset encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredAssets.map(asset => (
              <div key={asset.id} onClick={() => setSelectedAsset(asset)} className="premium-card group rounded-3xl overflow-hidden cursor-pointer border border-white/5 flex flex-col">
                <div className="aspect-video relative overflow-hidden bg-zinc-900">
                  <img src={asset.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={asset.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white text-black px-3 py-1 rounded-full">Detalhes</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-black uppercase italic truncate mb-2">{asset.title}</h3>
                  <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    <span>{asset.category}</span>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1"><Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} /> {asset.likes?.length || 0}</span>
                      <span className="flex items-center gap-1"><Icons.Download /> {asset.downloadCount || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentUser && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-12 right-12 bg-white text-black w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40">
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Asset Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-6xl bg-[#080808] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
            <div className="lg:w-2/3 p-8 lg:p-12 overflow-y-auto custom-scrollbar">
              <div className="aspect-video rounded-3xl overflow-hidden bg-black mb-12 border border-white/5">
                <video src={selectedAsset.videoUrl} autoPlay muted loop className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4">{selectedAsset.title}</h2>
              <p className="text-zinc-500 mb-8 leading-relaxed text-sm">{selectedAsset.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-12">
                {selectedAsset.keywords?.map(kw => (
                  <span key={kw} className="text-[8px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg text-zinc-400">#{kw}</span>
                ))}
              </div>

              <div className="border-t border-white/5 pt-12">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 mb-8">Comentários ({selectedAsset.comments?.length || 0})</h4>
                <form onSubmit={handleAddComment} className="flex gap-4 mb-12">
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="DIGITE SEU COMENTÁRIO..." className="flex-grow bg-zinc-900 border border-white/5 rounded-2xl p-4 text-[10px] font-black uppercase outline-none focus:border-white/20" />
                  <button type="submit" className="bg-white text-black px-8 rounded-2xl text-[10px] font-black uppercase">Postar</button>
                </form>
                <div className="space-y-6">
                  {selectedAsset.comments?.map(c => (
                    <div key={c.id} className="flex gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all">
                      <img src={c.userAvatar} className="w-8 h-8 rounded-lg grayscale" alt={c.userName} />
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase text-zinc-600 mb-1">{c.userName}</p>
                        <p className="text-[11px] font-medium text-white break-words">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:w-1/3 bg-zinc-900/30 p-8 lg:p-12 border-l border-white/5 space-y-8 flex flex-col">
              <div className="p-6 bg-white/5 rounded-2xl space-y-4">
                 <button onClick={() => handleLike(selectedAsset.id)} className={`w-full py-4 rounded-xl flex items-center justify-center gap-4 font-black uppercase text-[10px] transition-all ${selectedAsset.likes?.includes(currentUser?.id || '') ? 'bg-blue-600 text-white' : 'bg-white/5 text-white'}`}>
                    <Icons.Like filled={selectedAsset.likes?.includes(currentUser?.id || '')} /> {selectedAsset.likes?.length || 0} CURTIDAS
                 </button>
                 <button onClick={() => handleDownload(selectedAsset)} className="w-full py-4 rounded-xl bg-white text-black font-black uppercase text-[10px] hover:brightness-90 transition-all">
                    DOWNLOAD {selectedAsset.fileType}
                 </button>
              </div>
              <div className="text-[10px] font-black uppercase space-y-4 text-zinc-600 flex-grow">
                <div className="flex justify-between border-b border-white/5 pb-2"><span>Formato</span><span className="text-white">{selectedAsset.fileType}</span></div>
                <div className="flex justify-between border-b border-white/5 pb-2"><span>Downloads</span><span className="text-white">{selectedAsset.downloadCount}</span></div>
                <div className="flex justify-between border-b border-white/5 pb-2"><span>Autor</span><span className="text-white truncate max-w-[150px]">{selectedAsset.authorName}</span></div>
                <div className="flex flex-col gap-2">
                  <span>Créditos</span>
                  <p className="text-white lowercase normal-case italic">{selectedAsset.credits || 'Nenhum crédito adicional'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 border border-white/5 rounded-xl text-[10px] font-black uppercase hover:bg-white/5 transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-12 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black italic uppercase mb-12 tracking-tighter">Novo Deploy</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Título</label>
                    <input required name="title" placeholder="Nome do asset" className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-[11px] font-black uppercase outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Categoria</label>
                    <select required name="category" className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-[11px] font-black uppercase outline-none focus:border-white/20">
                      {Object.values(Category).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Descrição</label>
                    <textarea required name="desc" placeholder="Funcionalidades, requisitos..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 h-32 resize-none text-[11px] font-black uppercase outline-none focus:border-white/20" />
                  </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Arquivo Roblox (.rbxm/.rbxl)</label>
                      <input required name="file" type="file" accept=".rbxm,.rbxl" className="w-full bg-zinc-900 p-4 rounded-2xl text-[8px] file:hidden" />
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Vídeo de Showcase (MP4)</label>
                      <input required name="video" type="file" accept="video/mp4" className="w-full bg-zinc-900 p-4 rounded-2xl text-[8px] file:hidden" />
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Thumbnail (Imagem)</label>
                      <input required name="thumb" type="file" accept="image/*" className="w-full bg-zinc-900 p-4 rounded-2xl text-[8px] file:hidden" />
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 mb-2 block">Créditos</label>
                      <input required name="credits" placeholder="Colaboradores ou criador original" className="w-full bg-zinc-900 p-4 rounded-2xl text-[10px] font-black uppercase outline-none focus:border-white/20" />
                   </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <button disabled={isUploading} className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100">
                  {isUploading ? (
                    <span className="flex items-center justify-center gap-4">
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      {uploadProgress}
                    </span>
                  ) : 'Iniciar Sincronização'}
                </button>
                <button type="button" onClick={() => !isUploading && setShowUpload(false)} className="w-full mt-4 py-4 text-[10px] font-black uppercase text-zinc-600 hover:text-white transition-colors">Cancelar</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
