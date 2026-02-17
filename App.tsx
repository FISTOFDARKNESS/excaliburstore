
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, User, Category, RobloxFileType, Comment } from './types';
import { Icons } from './constants';
import { githubStorage } from './services/githubService';
import { storage } from './services/neonService'; // Still used for transient meta like comments/likes if needed, or we can use GH
import { generateKeywords, semanticSearch } from './services/geminiService';

const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSearch, setExpandedSearch] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'explore' | 'market' | 'profile'>('explore');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const syncRegistry = useCallback(async () => {
    const list = await githubStorage.getAllAssets();
    setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
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
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
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

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return alert("Login obrigatório.");
    setIsUploading(true);
    setUploadProgress('Analisando arquivos...');

    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const desc = formData.get('desc') as string;
    const credits = formData.get('credits') as string;
    const category = formData.get('category') as Category;

    // Validações Rígidas
    const allowedExtensions = ['.rbxm', '.rbxl', '.rbxmx'];
    const fileExt = assetFile.name.substring(assetFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      alert("Tipo de arquivo inválido. Apenas .rbxm, .rbxl e .rbxmx.");
      setIsUploading(false);
      return;
    }

    if (!videoFile.type.includes('video/mp4')) {
      alert("O showcase de vídeo deve ser obrigatoriamente MP4.");
      setIsUploading(false);
      return;
    }

    try {
      setUploadProgress('Gerando metadados via AI...');
      const keywords = await generateKeywords(title, desc);

      const assetId = crypto.randomUUID();
      const newAsset: Asset = {
        id: assetId,
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: title,
        originalFileName: assetFile.name,
        description: desc,
        category: category,
        thumbnailUrl: '', // Will be set by service
        fileUrl: '',      // Will be set by service
        fileType: fileExt as RobloxFileType,
        downloadCount: 0,
        likes: [],
        reports: 0,
        credits: credits,
        comments: [],
        timestamp: Date.now(),
        keywords: keywords
      };

      setUploadProgress('Transmitindo para o repositório GitHub...');
      await githubStorage.uploadAsset(newAsset, { asset: assetFile, thumb: thumbFile, video: videoFile });
      
      setUploadProgress('Finalizado!');
      setTimeout(() => {
        setShowUpload(false);
        setIsUploading(false);
        syncRegistry();
      }, 1000);
    } catch (err) {
      alert("Erro no upload: " + (err as Error).message);
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
    return list.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q)));
  }, [assets, searchQuery, activeTab, currentUser]);

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505]">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black tracking-[0.5em] text-white uppercase animate-pulse">Sincronizando Core...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row selection:bg-blue-600/30">
      {/* Sidebar - Fixa na esquerda em Desktop */}
      <aside className="w-full lg:w-72 border-r border-white/5 flex flex-col p-8 lg:fixed h-auto lg:h-full z-50 bg-[#050505]">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-white/10 rotate-3">
             <Icons.Model />
          </div>
          <div>
            <h1 className="font-black italic text-2xl tracking-tighter leading-none">EXCALIBUR</h1>
            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-600">Secure Assets Hub</span>
          </div>
        </div>

        <nav className="flex lg:flex-col gap-3 overflow-x-auto pb-4 lg:pb-0">
          {[
            { id: 'explore', label: 'Explorar', icon: <Icons.Search /> },
            { id: 'market', label: 'Mercado', icon: <Icons.Script /> },
            { id: 'profile', label: 'Biblioteca', icon: <Icons.Plus /> }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest whitespace-nowrap lg:w-full ${activeTab === item.id ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                <img src={currentUser.avatar} className="w-9 h-9 rounded-xl grayscale hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="flex-grow min-w-0">
                  <p className="text-[10px] font-black truncate uppercase">{currentUser.name}</p>
                  <p className="text-[8px] font-bold text-zinc-600 truncate">{currentUser.email}</p>
                </div>
              </div>
              <button onClick={() => {setCurrentUser(null); localStorage.removeItem('ex_session');}} className="w-full text-[9px] font-black uppercase text-red-500/60 hover:text-red-500 transition-colors tracking-widest">Desconectar</button>
            </div>
          ) : (
            <div className="p-6 bg-blue-600/5 border border-blue-600/10 rounded-3xl text-center space-y-6">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-relaxed px-2">Autenticação obrigatória para acesso ao repositório</p>
              <div className="g_id_signin" data-type="standard" data-theme="filled_black" data-size="large" data-width="100%"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow lg:ml-72 p-6 lg:p-16">
        <header className="max-w-6xl mx-auto mb-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-zinc-900 border border-white/5 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Status: Sistema Online</span>
              </div>
              <h2 className="text-6xl lg:text-8xl font-black italic tracking-tighter uppercase leading-[0.85] text-white">
                {activeTab === 'explore' ? 'ARQUIVO' : activeTab === 'market' ? 'MERCADO' : 'SEUS ASSETS'}
              </h2>
            </div>
            
            <div className="relative group w-full lg:w-[420px]">
              <input 
                type="text" 
                placeholder="Escaneando rede..." 
                className="bg-[#0a0a0a] border border-white/5 rounded-2xl py-6 px-16 w-full focus:outline-none focus:border-blue-600/40 transition-all font-bold text-lg placeholder:text-zinc-800"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700"><Icons.Search /></div>
            </div>
          </div>
        </header>

        <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {filteredAssets.length > 0 ? filteredAssets.map(asset => (
            <div 
              key={asset.id} 
              onClick={() => setSelectedAsset(asset)}
              className="premium-card group rounded-[2.5rem] overflow-hidden cursor-pointer flex flex-col border border-white/5 hover:border-blue-600/20"
            >
              <div className="aspect-[1.2/1] relative overflow-hidden bg-zinc-900">
                <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute top-6 left-6 flex gap-2">
                  <div className="bg-black/80 backdrop-blur-xl px-4 py-1.5 rounded-xl border border-white/10">
                    <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest">{asset.category}</span>
                  </div>
                </div>
              </div>
              <div className="p-8 flex-grow space-y-4">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter truncate leading-none group-hover:text-blue-500 transition-colors">{asset.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={asset.authorAvatar} className="w-5 h-5 rounded-md grayscale" />
                    <span className="text-[10px] font-bold text-zinc-500 tracking-tight">@{asset.authorName.split(' ')[0]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-zinc-700"><Icons.Download /> {asset.downloadCount}</span>
                    <span className="text-[10px] font-black text-zinc-700"><Icons.Like /> {asset.likes.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-40 text-center opacity-10">
              <h2 className="text-9xl font-black italic tracking-tighter uppercase leading-none">VOID</h2>
            </div>
          )}
        </section>

        {/* Floating Upload Button */}
        {currentUser && (
          <button 
            onClick={() => setShowUpload(true)}
            className="fixed bottom-12 right-12 bg-white text-black w-20 h-20 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.15)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
          >
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Detailed Modal View */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-7xl bg-[#080808] border border-white/10 rounded-[4rem] shadow-2xl flex flex-col lg:flex-row max-h-[92vh] overflow-hidden">
            <div className="flex-grow p-8 lg:p-20 overflow-y-auto custom-scrollbar">
              <div className="aspect-video rounded-[3rem] overflow-hidden bg-zinc-900 mb-16 border border-white/5 relative group">
                <video src={selectedAsset.videoUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-12">
                   <div>
                     <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-2">Showcase Oficial</p>
                     <h2 className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter">{selectedAsset.title}</h2>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                 <div className="lg:col-span-2 space-y-12">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">Relatório Técnico</h4>
                      <p className="text-zinc-400 text-xl font-medium leading-relaxed">{selectedAsset.description}</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">Créditos de Engenharia</h4>
                      <p className="text-white text-lg font-black italic">{selectedAsset.credits}</p>
                    </div>
                 </div>

                 <div className="space-y-10">
                    <div className="p-8 bg-zinc-900/50 rounded-[2.5rem] border border-white/5">
                      <div className="flex items-center gap-4 mb-8">
                         <img src={selectedAsset.authorAvatar} className="w-12 h-12 rounded-2xl" />
                         <div>
                           <p className="text-[10px] font-black uppercase text-zinc-600">Publicado por</p>
                           <p className="text-sm font-black italic">{selectedAsset.authorName}</p>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                           <span>Transmissões</span>
                           <span className="text-white">{selectedAsset.downloadCount}</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                           <span>Aprovação</span>
                           <span className="text-blue-500">{selectedAsset.likes.length} LIKES</span>
                         </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => currentUser ? window.open(selectedAsset.fileUrl, '_blank') : alert("Login necessário")}
                      className="w-full bg-white text-black py-8 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] active:scale-95 transition-all shadow-2xl hover:brightness-90"
                    >
                      DOWNLOAD .BIN
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strictly Validated Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[4rem] p-12 lg:p-20 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <header className="mb-12">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">Deploy de Novo Asset</h2>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-2">Protocolo de Registro Obrigatório</p>
            </header>

            <div className="space-y-10">
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Identificação</label>
                <input required name="title" placeholder="Nome do Asset" className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-6 font-bold text-lg focus:outline-none focus:border-blue-600/30" />
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Especificação</label>
                <textarea required name="desc" placeholder="Detalhes técnicos..." className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-6 font-bold h-32 focus:outline-none focus:border-blue-600/30 resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Binário (.rbxm/.rbxl)</label>
                  <input required name="file" type="file" accept=".rbxm,.rbxl,.rbxmx" className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-4 text-[10px] font-black uppercase" />
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Showcase MP4</label>
                  <input required name="video" type="file" accept="video/mp4" className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-4 text-[10px] font-black uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Thumbnail</label>
                  <input required name="thumb" type="file" accept="image/*" className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-4 text-[10px] font-black uppercase" />
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.3em] ml-4">Créditos/Autoria</label>
                  <input required name="credits" placeholder="Ex: Criado por FISTOFDARKNESS" className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-6 font-black text-sm uppercase" />
                </div>
              </div>

              <div className="pt-8">
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.5em] shadow-2xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                >
                  {isUploading ? uploadProgress : 'INICIAR BROADCAST'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Global hook for Google Identity
(window as any).handleCredentialResponse = (response: any) => {
  const event = new CustomEvent('google-login', { detail: response });
  window.dispatchEvent(event);
};
