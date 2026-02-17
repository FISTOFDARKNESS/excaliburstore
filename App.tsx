
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Asset, User, Category, RobloxFileType } from './types';
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
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isHovered && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (!isHovered && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isHovered]);

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`premium-card h-[380px] flex flex-col group cursor-pointer ${asset.reports > 5 ? 'grayscale opacity-50' : ''}`}
    >
      <div className="h-[220px] relative overflow-hidden bg-black">
        <img 
          src={`${asset.thumbnailUrl}?t=${asset.timestamp}`} 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered && asset.videoUrl ? 'opacity-0' : 'opacity-100'}`}
          alt={asset.title}
        />
        {asset.videoUrl && (
          <video 
            ref={videoRef}
            src={`${asset.videoUrl}?t=${asset.timestamp}`} 
            muted 
            loop 
            playsInline 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`} 
          />
        )}
        
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-widest text-zinc-300">
            {asset.category}
          </div>
          {asset.authorVerified && (
             <div className="bg-blue-500/30 backdrop-blur-md p-1.5 rounded-lg border border-blue-500/40">
               <Icons.Verified className="w-4 h-4 text-blue-400" />
             </div>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="text-[16px] font-black uppercase italic tracking-tight truncate group-hover:text-white transition-colors">
            {asset.title}
          </h3>
          <div className="flex items-center gap-3 mt-3">
            <img src={asset.authorAvatar} className="w-6 h-6 rounded-lg grayscale border border-white/10" referrerPolicy="no-referrer" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{asset.authorName}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-white/5">
          <div className="flex gap-5">
            <div className="flex items-center gap-1.5">
              <Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} className={`w-4 h-4 ${asset.likes?.includes(currentUser?.id || '') ? 'text-red-500' : 'text-zinc-600'}`} />
              <span className="text-[11px] font-black text-zinc-500">{asset.likes?.length || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icons.Download className="w-4 h-4 text-zinc-600" />
              <span className="text-[11px] font-black text-zinc-500">{asset.downloadCount || 0}</span>
            </div>
          </div>
          <span className="text-[9px] font-black text-zinc-800 tracking-tighter">REF: {asset.id.split('-').pop()}</span>
        </div>
      </div>
    </div>
  );
};

type TabId = 'explore' | 'verified' | 'market' | 'profile' | 'admin';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
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

  const isAdmin = (user: User | null) => user ? (user.isAdmin || ADMIN_EMAILS.includes(user.email)) : false;

  const syncRegistry = useCallback(async () => {
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const init = async () => {
      await syncRegistry();
      const session = localStorage.getItem('ex_session_v3');
      if (session) {
        try {
          const u = JSON.parse(session);
          const fresh = await githubStorage.getUserProfile(u.id);
          if (fresh && !fresh.user.isBanned) {
            setCurrentUser(fresh.user);
          } else {
            localStorage.removeItem('ex_session_v3');
          }
        } catch { localStorage.removeItem('ex_session_v3'); }
      }
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  useEffect(() => {
    if (currentUser) return;
    const initGoogle = () => {
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
            localStorage.setItem('ex_session_v3', JSON.stringify(user));
          },
        });
        window.google.accounts.id.renderButton(btn, { 
          theme: 'filled_black', 
          size: 'large', 
          shape: 'pill', 
          width: 240,
          text: 'signin_with'
        });
      }
    };

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b' && isAdmin(currentUser)) {
        e.preventDefault();
        setActiveTab('admin');
        githubStorage.getAllUsers().then(setAllUsers);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  const handleLogout = () => {
    if (confirm("Disconnect from Excalibur Mainframe?")) {
      setCurrentUser(null);
      localStorage.removeItem('ex_session_v3');
      window.location.reload();
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Login required for binary sync.");
    window.open(asset.fileUrl, '_blank');
    const updated = await githubStorage.incrementDownload(asset.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleLike = async (asset: Asset) => {
    if (!currentUser) return alert("Identification required.");
    const updated = await githubStorage.toggleLike(asset.id, currentUser.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleReport = async (asset: Asset) => {
    if (!currentUser) return alert("Identification required.");
    if (confirm("Report this module for investigation?")) {
      const updated = await githubStorage.incrementReport(asset.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
      alert("Report filed. Central moderation informed.");
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;

    if (!ALLOWED_ROBLOX_EXTENSIONS.some(ext => assetFile.name.toLowerCase().endsWith(ext))) {
      return alert("Forbidden format. Excalibur accepts only .rbxm, .rbxl or .rbxmx.");
    }
    
    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress("Analyzing Binary DNA via Gemini AI...");
    
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
      alert("Transmission failed. Central uplink lost.");
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) list = list.filter(a => a.userId === currentUser.id);
    else if (activeTab === 'verified') list = list.filter(a => a.authorVerified);
    
    const q = searchQuery.toLowerCase();
    return q ? list.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.keywords.some(k => k.toLowerCase().includes(q))
    ) : list;
  }, [assets, searchQuery, activeTab, currentUser]);

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-black">
      <div className="w-16 h-16 border-4 border-white/5 border-t-white rounded-full animate-spin mb-10" />
      <div className="text-[10px] font-black uppercase tracking-[1.5em] animate-pulse">Excalibur Boot Sequence</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row max-w-[1600px] mx-auto p-4 lg:p-10 gap-10">
      
      <aside className="w-full lg:w-72 shrink-0 flex flex-col glass-panel rounded-[2.5rem] p-8 lg:fixed h-auto lg:h-[calc(100vh-80px)] z-50">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-white/20">
            <Icons.Model className="w-7 h-7 text-black" />
          </div>
          <h1 className="font-black italic text-2xl tracking-tighter">EXCALIBUR</h1>
        </div>

        <nav className="flex flex-col gap-3 flex-grow overflow-y-auto custom-scrollbar">
          <button onClick={() => setActiveTab('explore')} className={`sidebar-item ${activeTab === 'explore' ? 'active' : ''}`}>
             <Icons.Search className="w-5 h-5" /> <span>Explore</span>
          </button>
          <button onClick={() => setActiveTab('verified')} className={`sidebar-item ${activeTab === 'verified' ? 'active' : ''}`}>
             <Icons.Verified className="w-5 h-5" /> <span>Verified</span>
          </button>
          <button onClick={() => setActiveTab('market')} className={`sidebar-item ${activeTab === 'market' ? 'active' : ''}`}>
             <Icons.Script className="w-5 h-5" /> <span>Market</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}>
             <Icons.Plus className="w-5 h-5" /> <span>My Lab</span>
          </button>
          
          {isAdmin(currentUser) && (
            <button onClick={() => setActiveTab('admin')} className={`sidebar-item mt-10 ${activeTab === 'admin' ? 'bg-brand-red text-white' : 'text-brand-red/50 hover:bg-brand-red/10'}`}>
               <Icons.Report className="w-5 h-5" /> <span>Terminal</span>
            </button>
          )}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="flex items-center gap-4 p-4 glass-panel rounded-3xl border-none">
              <img src={currentUser.avatar} className="w-10 h-10 rounded-xl grayscale border border-white/10" referrerPolicy="no-referrer" />
              <div className="flex-grow min-w-0">
                <p className="text-[13px] font-black truncate leading-none mb-2">{currentUser.name}</p>
                <button onClick={handleLogout} className="text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[9px] font-black uppercase text-zinc-700 tracking-widest text-center">Protocol Identity</p>
              <div id="google-login-btn" className="w-full flex justify-center scale-95 origin-center"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-[340px] pt-4">
        <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.8em] text-zinc-600 mb-4 italic">Directory // Mainframe</p>
            <h2 className="text-7xl font-black italic uppercase tracking-tighter leading-none">{activeTab}</h2>
          </div>
          <div className="relative w-full md:w-96 group">
            <Icons.Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              placeholder="Locate module..." 
              className="w-full glass-panel rounded-2xl py-6 pl-14 pr-8 text-[12px] font-black uppercase outline-none focus:border-white/30 transition-all placeholder:text-zinc-800"
            />
          </div>
        </header>

        {activeTab === 'admin' && isAdmin(currentUser) ? (
          <div className="animate-fade-in space-y-12">
            <div className="glass-panel rounded-[2.5rem] overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-white/5 text-[11px] uppercase font-black tracking-[0.2em] text-zinc-500">
                    <tr>
                      <th className="px-10 py-6">Agent Entity</th>
                      <th className="px-10 py-6">Status Protocol</th>
                      <th className="px-10 py-6 text-right">Directives</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5 text-[12px] font-bold">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-5">
                            <img src={u.avatar} className="w-10 h-10 rounded-xl border border-white/10 grayscale" referrerPolicy="no-referrer" />
                            <div>
                              <p className="text-white uppercase font-black tracking-tight">{u.name}</p>
                              <p className="text-[10px] opacity-40 lowercase font-medium italic">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex gap-3">
                            {u.isVerified && <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[9px] border border-blue-500/20 font-black">VERIFIED</span>}
                            {u.isBanned && <span className="px-3 py-1 rounded-lg bg-red-600/10 text-red-500 text-[9px] border border-red-500/20 font-black">BANNED</span>}
                            {u.isAdmin && <span className="px-3 py-1 rounded-lg bg-white/10 text-white text-[9px] border border-white/20 font-black">ROOT</span>}
                          </div>
                        </td>
                        <td className="px-10 py-6 text-right space-x-3">
                           <button onClick={() => githubStorage.verifyUser(u.id, !u.isVerified).then(() => githubStorage.getAllUsers().then(setAllUsers))} className="bg-white/5 px-4 py-2 rounded-xl hover:bg-white/10 text-[10px] uppercase font-black tracking-widest">Verify</button>
                           <button onClick={() => githubStorage.toggleBan(u.id).then(() => githubStorage.getAllUsers().then(setAllUsers))} className="bg-red-600/10 text-red-500 px-4 py-2 rounded-xl hover:bg-red-600/20 text-[10px] uppercase font-black tracking-widest">{u.isBanned ? 'Restore' : 'Ban'}</button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredAssets.map(asset => (
              <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />
            ))}
            {filteredAssets.length === 0 && (
              <div className="col-span-full py-48 text-center flex flex-col items-center opacity-10">
                <Icons.Model className="w-20 h-20 mb-6" />
                <p className="text-[14px] font-black uppercase tracking-[1em]">Sector Empty</p>
              </div>
            )}
          </div>
        )}

        {currentUser && !currentUser.isBanned && (
          <button 
            onClick={() => setShowUpload(true)} 
            className="fixed bottom-12 right-12 w-20 h-20 bg-white text-black rounded-[2.5rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[8px] border-brand-black group animate-float"
          >
            <Icons.Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        )}
      </main>

      {/* Asset Detail Overlay */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-brand-black/98 backdrop-blur-3xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-7xl glass-panel rounded-[3.5rem] overflow-hidden flex flex-col md:flex-row max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-fade-in">
            <div className="md:w-[68%] p-10 lg:p-14 overflow-y-auto custom-scrollbar border-r border-white/5">
              <div className="aspect-video rounded-[3rem] overflow-hidden bg-black mb-12 shadow-2xl border border-white/10 group relative">
                <video src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 leading-none">{selectedAsset.title}</h2>
              <div className="flex flex-wrap gap-3 mb-12">
                {selectedAsset.keywords?.map(k => (
                  <span key={k} className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">#{k}</span>
                ))}
              </div>
              <div className="bg-white/[0.03] rounded-[2.5rem] p-10 border border-white/5">
                <p className="text-zinc-400 text-sm lg:text-base leading-relaxed whitespace-pre-wrap italic font-medium">"{selectedAsset.description}"</p>
              </div>
            </div>

            <div className="md:w-[32%] p-10 lg:p-14 flex flex-col justify-between bg-zinc-950/40">
              <div className="space-y-12">
                <div onClick={() => { setSelectedAsset(null); githubStorage.getUserProfile(selectedAsset.userId).then(d => setViewedUser(d?.user || null)); }} className="p-6 glass-panel rounded-[2.5rem] flex items-center gap-6 cursor-pointer hover:bg-white/5 transition-all group">
                  <img src={selectedAsset.authorAvatar} className="w-16 h-16 rounded-2xl grayscale group-hover:grayscale-0 transition-all border border-white/10 shadow-xl" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[16px] font-black uppercase flex items-center gap-2 truncate">
                      {selectedAsset.authorName}
                      {selectedAsset.authorVerified && <Icons.Verified className="w-5 h-5 text-blue-400" />}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] mt-1.5">Verified Agent</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="p-6 glass-panel rounded-[2rem] text-center border-white/5">
                    <p className="text-3xl font-black leading-none">{selectedAsset.downloadCount}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 mt-3">Syncs</p>
                  </div>
                  <div className="p-6 glass-panel rounded-[2rem] text-center border-white/5">
                    <p className="text-3xl font-black leading-none">{selectedAsset.likes?.length || 0}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 mt-3">Likes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <button onClick={() => handleDownload(selectedAsset)} className="w-full py-7 rounded-[2.5rem] bg-white text-black font-black uppercase text-[13px] tracking-[0.4em] shadow-2xl hover:bg-zinc-200 transition-all active:scale-95">
                    Sync Binary
                  </button>
                  <div className="flex gap-4">
                    <button onClick={() => handleLike(selectedAsset)} className="flex-grow py-5 rounded-[1.5rem] glass-panel flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest hover:bg-white/5">
                      <Icons.Like filled={selectedAsset.likes?.includes(currentUser?.id || '')} className={`w-5 h-5 ${selectedAsset.likes?.includes(currentUser?.id || '') ? 'text-red-500' : ''}`} />
                    </button>
                    <button onClick={() => handleReport(selectedAsset)} className="p-5 rounded-[1.5rem] glass-panel text-zinc-600 hover:text-brand-red">
                      <Icons.Report className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-12 text-center">
                <p className="text-[10px] font-black uppercase text-zinc-800 tracking-[0.3em] mb-6">DATA UNIT: EXC-{selectedAsset.id.split('-').pop()}</p>
                <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[12px] font-black uppercase tracking-[0.6em] text-zinc-700 hover:text-white transition-colors">Abort Interface</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Interface */}
      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-brand-black/98 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <div className="relative w-full max-w-4xl glass-panel rounded-[4rem] overflow-hidden flex flex-col max-h-[92vh] shadow-[0_0_150px_rgba(255,255,255,0.03)] animate-fade-in border-white/5">
            <header className="p-12 border-b border-white/5 flex justify-between items-center bg-black/40">
               <div className="flex items-center gap-5">
                 <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center"><Icons.Plus className="w-6 h-6" /></div>
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter">New Transmission</h2>
               </div>
               {!isUploading && (
                  <button onClick={() => setShowUpload(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-zinc-700 hover:text-white">
                    <Icons.Plus className="w-7 h-7 rotate-45" />
                  </button>
               )}
            </header>

            <form onSubmit={handleUpload} className="p-12 space-y-12 overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <label className="text-[11px] font-black uppercase text-zinc-600 tracking-[0.3em] mb-3 block italic">Module Designation</label>
                      <input required name="title" placeholder="ENTER PROJECT ALIAS..." className="input-terminal py-4" />
                    </div>
                    <div>
                      <label className="text-[11px] font-black uppercase text-zinc-600 tracking-[0.3em] mb-3 block italic">Registry Sector</label>
                      <select name="category" className="input-terminal py-4 appearance-none cursor-pointer">
                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-zinc-600 tracking-[0.3em] mb-3 block italic">Function Log</label>
                    <textarea required name="desc" placeholder="DETAIL OPERATIONAL SCOPE..." className="input-terminal h-[154px] resize-none pt-4" />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <label className="group glass-panel rounded-[2.5rem] p-8 h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/20">
                    <Icons.Script className="w-12 h-12 mb-5 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Source Binary</span>
                    <input required type="file" name="file" accept=".rbxm,.rbxl,.rbxmx" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-[2.5rem] p-8 h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/20">
                    <Icons.Model className="w-12 h-12 mb-5 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Interface Cover</span>
                    <input required type="file" name="thumb" accept="image/*" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-[2.5rem] p-8 h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/20">
                    <Icons.Download className="w-12 h-12 mb-5 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Hologram Preview</span>
                    <input required type="file" name="video" accept="video/mp4" className="hidden" />
                  </label>
               </div>

               <div className="pt-10 flex justify-end items-center gap-10">
                  <button type="button" onClick={() => setShowUpload(false)} className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-800 hover:text-white transition-colors">Abort Sync</button>
                  <button type="submit" className="px-16 py-6 rounded-[2rem] bg-white text-black text-[14px] font-black uppercase tracking-[0.4em] shadow-2xl hover:bg-zinc-200 transition-all active:scale-95">Initiate Uplink</button>
               </div>
            </form>

            {isUploading && (
              <div className="absolute inset-0 bg-brand-black/99 flex flex-col items-center justify-center p-16 z-50 text-center animate-fade-in">
                <div className="w-24 h-24 border-4 border-white/5 border-t-white rounded-full animate-spin mb-12 shadow-[0_0_50px_rgba(255,255,255,0.1)]" />
                <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-5">Link Active</h3>
                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-[0.8em] mb-16 animate-pulse">{uploadProgress}</p>
                <div className="flex gap-2.5 w-full max-w-[300px]">
                  {[1,2,3,4,5,6].map(i => <div key={i} className={`h-1.5 flex-grow rounded-full transition-all duration-1000 ${i <= uploadStep ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.7)]' : 'bg-white/10'}`} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
