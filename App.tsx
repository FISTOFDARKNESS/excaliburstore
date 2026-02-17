
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

const AssetCard = ({ asset, currentUser, onClick }: { asset: Asset, currentUser: User | null, onClick: () => void }) => {
  const [showVideo, setShowVideo] = useState(false);
  const hoverTimer = useRef<any>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowVideo(true), 1200);
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
          <video src={`${asset.videoUrl}?t=${asset.timestamp}`} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="p-6 flex flex-col justify-between flex-grow bg-gradient-to-b from-transparent to-black/40">
        <div>
          <h3 className="text-xl font-black uppercase italic truncate mb-1 flex items-center gap-2">
            {asset.title}
            {asset.authorVerified && <Icons.Verified />}
          </h3>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Provider: {asset.authorName}</p>
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

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'market' | 'profile'>('explore');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewedUser, setViewedUser] = useState<User | null>(null); // Perfil de terceiros
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStep, setUploadStep] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

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
    if (currentUser) return;
    let interval = setInterval(() => {
      if (window.google?.accounts?.id) {
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
        const btn = document.getElementById('google-login-btn');
        if (btn) window.google.accounts.id.renderButton(btn, { theme: 'filled_black', size: 'large', shape: 'pill' });
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentUser]);

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
      alert("Status de verificação atualizado.");
    } catch (e) { alert("Erro ao verificar"); }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login necessário");
    window.open(asset.fileUrl, '_blank');
    await githubStorage.incrementDownload(asset.id);
    syncRegistry();
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedAsset || !commentText.trim()) return;
    setIsPostingComment(true);
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
    setIsPostingComment(false);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    if (!ALLOWED_ROBLOX_EXTENSIONS.some(ext => assetFile.name.toLowerCase().endsWith(ext))) return alert("Arquivo inválido");
    
    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress("Gerando Keywords com IA...");
    const title = formData.get('title') as string;
    const desc = formData.get('desc') as string;
    const keywords = await generateKeywords(title, desc);
    
    const asset: Asset = {
      id: `EXC-${Date.now().toString(36).toUpperCase()}`,
      userId: currentUser.id, authorName: currentUser.name, authorAvatar: currentUser.avatar,
      title, description: desc, originalFileName: assetFile.name,
      category: formData.get('category') as Category,
      fileType: assetFile.name.slice(assetFile.name.lastIndexOf('.')) as RobloxFileType,
      thumbnailUrl: '', fileUrl: '', downloadCount: 0, likes: [], reports: 0, credits: formData.get('credits') as string,
      comments: [], timestamp: Date.now(), keywords
    };

    await githubStorage.uploadAsset(asset, {
      asset: assetFile,
      thumb: formData.get('thumb') as File,
      video: formData.get('video') as File
    }, setUploadProgress);

    setIsUploading(false);
    setShowUpload(false);
    syncRegistry();
  };

  const openUserProfile = async (userId: string) => {
    const data = await githubStorage.getUserProfile(userId);
    if (data) {
      setViewedUser(data.user);
      setSelectedAsset(null);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) list = list.filter(a => a.userId === currentUser.id);
    const q = searchQuery.toLowerCase();
    return q ? list.filter(a => a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q))) : list;
  }, [assets, searchQuery, activeTab, currentUser]);

  const userAssets = useMemo(() => viewedUser ? assets.filter(a => a.userId === viewedUser.id) : [], [assets, viewedUser]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-black text-[10px] font-black uppercase tracking-[1em] animate-pulse">EXCALIBUR OS</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 border-r border-white/5 flex flex-col p-6 lg:fixed h-auto lg:h-full z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center rotate-3"><Icons.Model /></div>
          <h1 className="font-black italic text-lg">EXCALIBUR</h1>
        </div>
        <nav className="flex lg:flex-col gap-1.5">
          {['explore', 'market', 'profile'].map(id => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`flex items-center gap-3 p-3.5 rounded-xl font-bold text-[9px] uppercase tracking-widest ${activeTab === id ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>
               {id === 'explore' ? <Icons.Search /> : id === 'market' ? <Icons.Script /> : <Icons.Plus />}
               {id}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5">
          {currentUser ? (
            <div className="p-3.5 bg-white/5 rounded-xl flex items-center gap-3 cursor-pointer" onClick={() => openUserProfile(currentUser.id)}>
              <img src={currentUser.avatar} className="w-7 h-7 rounded-lg" />
              <div className="flex-grow min-w-0">
                <p className="text-[9px] font-black truncate flex items-center gap-1">
                  {currentUser.name} {currentUser.isVerified && <Icons.Verified className="w-3 h-3 text-blue-400" />}
                </p>
                <p className="text-[7px] text-zinc-500 font-bold uppercase">{currentUser.followers.length} Followers</p>
              </div>
            </div>
          ) : <div id="google-login-btn"></div>}
        </div>
      </aside>

      <main className="flex-grow lg:ml-64 p-6 lg:p-12">
        <header className="mb-14 flex justify-between items-end">
           <div><h2 className="text-5xl font-black italic uppercase tracking-tighter">{activeTab}</h2></div>
           <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PROTOCOL SEARCH..." className="w-64 bg-zinc-900 border border-white/5 rounded-xl py-3 px-6 text-[10px] font-black outline-none" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />)}
        </div>

        {currentUser && (
          <button onClick={() => setShowUpload(true)} className="fixed bottom-10 right-10 bg-white text-black w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-all z-40 border-[6px] border-black">
            <Icons.Plus />
          </button>
        )}
      </main>

      {/* Profile Detail View */}
      {viewedUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setViewedUser(null)} />
          <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh]">
             <div className="p-10 border-b border-white/5 flex items-center gap-8 bg-gradient-to-r from-blue-900/10 to-transparent">
                <img src={viewedUser.avatar} className="w-32 h-32 rounded-3xl border border-white/10 shadow-2xl" />
                <div className="flex-grow">
                   <div className="flex items-center gap-4 mb-2">
                      <h2 className="text-4xl font-black italic uppercase">{viewedUser.name}</h2>
                      {viewedUser.isVerified && <Icons.Verified className="w-8 h-8 text-blue-500" />}
                      {!viewedUser.isVerified && <span className="bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full text-[8px] font-black uppercase">Unverified</span>}
                   </div>
                   <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <span>{viewedUser.followers.length} Seguidores</span>
                      <span>{viewedUser.following.length} Seguindo</span>
                      <span>{userAssets.length} Assets</span>
                   </div>
                </div>
                <div className="flex flex-col gap-3">
                  {currentUser && currentUser.id !== viewedUser.id && (
                    <button onClick={() => handleFollow(viewedUser.id)} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${currentUser.following.includes(viewedUser.id) ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white text-black'}`}>
                      {currentUser.following.includes(viewedUser.id) ? 'Unfollow' : 'Follow'}
                    </button>
                  )}
                  {isAdmin(currentUser) && (
                    <button onClick={() => handleVerify(viewedUser.id, !viewedUser.isVerified)} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase">
                       {viewedUser.isVerified ? 'Remove Verified' : 'Grant Verified'}
                    </button>
                  )}
                </div>
             </div>
             <div className="p-10 overflow-y-auto custom-scrollbar">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-6">User Repositories</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userAssets.map(asset => (
                    <div key={asset.id} onClick={() => { setSelectedAsset(asset); setViewedUser(null); }} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all">
                       <img src={asset.thumbnailUrl} className="w-16 h-16 rounded-xl object-cover" />
                       <div>
                          <p className="font-black uppercase text-[12px]">{asset.title}</p>
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
              <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black mb-10 border border-white/10 shadow-2xl">
                <video src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl font-black italic uppercase mb-4 flex items-center gap-3">
                {selectedAsset.title}
                {selectedAsset.authorVerified && <Icons.Verified className="w-8 h-8" />}
              </h2>
              <p className="text-zinc-400 mb-10 text-sm bg-white/[0.02] p-6 rounded-[1.5rem] italic">"{selectedAsset.description}"</p>
              
              <div className="mt-12">
                <h3 className="text-xl font-black uppercase italic mb-8">Protocol Feedback</h3>
                {currentUser && (
                  <form onSubmit={handleCommentSubmit} className="mb-10 relative">
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Send feedback..." className="w-full bg-zinc-900 border border-white/5 rounded-[1.5rem] p-6 text-[11px] outline-none min-h-[100px]" />
                    <button type="submit" disabled={isPostingComment} className="absolute bottom-4 right-4 bg-white text-black px-6 py-2 rounded-xl text-[9px] font-black uppercase">Send</button>
                  </form>
                )}
                <div className="space-y-6">
                  {selectedAsset.comments?.map(c => (
                    <div key={c.id} className="bg-white/[0.03] p-6 rounded-[1.5rem] flex gap-4">
                      <img src={c.userAvatar} className="w-10 h-10 rounded-lg cursor-pointer" onClick={() => openUserProfile(c.userId)} />
                      <div>
                        <p className="text-[10px] font-black uppercase">{c.userName}</p>
                        <p className="text-zinc-400 text-[11px] italic">"{c.text}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:w-2/5 p-10 flex flex-col bg-black/40">
              <div className="p-6 bg-white/[0.04] rounded-[2rem] border border-white/5 mb-8 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all" onClick={() => openUserProfile(selectedAsset.userId)}>
                <img src={selectedAsset.authorAvatar} className="w-14 h-14 rounded-xl border border-white/10" />
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Provider</p>
                  <p className="text-[14px] font-black uppercase flex items-center gap-1">
                    {selectedAsset.authorName}
                    {selectedAsset.authorVerified && <Icons.Verified className="w-4 h-4" />}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">DLs</p>
                    <p className="text-2xl font-black">{selectedAsset.downloadCount}</p>
                 </div>
                 <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Likes</p>
                    <p className="text-2xl font-black">{selectedAsset.likes.length}</p>
                 </div>
              </div>
              <button onClick={() => handleDownload(selectedAsset)} className="w-full py-6 rounded-3xl bg-white text-black font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all mb-4">ADQUIRE FILE</button>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[9px] font-black uppercase text-zinc-700 hover:text-white transition-colors">Terminar Sessão</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal (Simplified for the sake of brevity in this snippet) */}
      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98" onClick={() => !isUploading && setShowUpload(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] shadow-2xl">
             <h2 className="text-3xl font-black italic uppercase mb-10">Transmissão</h2>
             {isUploading ? (
               <div className="py-12 flex flex-col items-center gap-8">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase animate-pulse">{uploadProgress}</p>
               </div>
             ) : (
               <div className="space-y-6">
                 <input required name="title" placeholder="ASSET TITLE" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 text-[10px] font-black uppercase outline-none" />
                 <textarea required name="desc" placeholder="SPECIFICATIONS" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 h-32 text-[10px] font-black uppercase outline-none" />
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-zinc-600 uppercase">Roblox File</label>
                     <input required name="file" type="file" accept=".rbxm,.rbxl,.rbxmx" className="text-[8px] opacity-50" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-zinc-600 uppercase">Category</label>
                     <select name="category" className="bg-zinc-900 w-full p-3 rounded-xl text-[9px] font-black uppercase border border-white/5">
                       {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-zinc-600 uppercase">Thumbnail</label>
                     <input required name="thumb" type="file" accept="image/*" className="text-[8px] opacity-50" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-zinc-600 uppercase">Preview Video</label>
                     <input required name="video" type="file" accept="video/mp4" className="text-[8px] opacity-50" />
                   </div>
                 </div>
                 <input required name="credits" placeholder="CREDITS / OWNERSHIP" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-5 text-[10px] font-black uppercase outline-none" />
                 <button type="submit" className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[11px]">Execute Transmission</button>
               </div>
             )}
          </form>
        </div>
      )}
    </div>
  );
}
