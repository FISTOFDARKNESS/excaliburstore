
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Asset, User, Category, RobloxFileType } from './types';
import { Icons } from './constants';
import { githubStorage } from './services/githubService';
import { generateKeywords, semanticSearch } from './services/geminiService';

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
      className={`premium-card h-[380px] flex flex-col group cursor-pointer ${asset.reports > 5 ? 'grayscale opacity-30 pointer-events-none' : ''}`}
    >
      {/* Thumbnail/Preview Section */}
      <div className="h-[230px] relative overflow-hidden bg-black">
        <img 
          src={`${asset.thumbnailUrl}?t=${asset.timestamp}`} 
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${isHovered && asset.videoUrl ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}
          alt={asset.title}
        />
        {asset.videoUrl && (
          <video 
            ref={videoRef}
            src={`${asset.videoUrl}?t=${asset.timestamp}`} 
            muted 
            loop 
            playsInline 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`} 
          />
        )}
        
        {/* Sector Tag */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="bg-black/90 backdrop-blur-xl px-4 py-1.5 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
            {asset.category}
          </div>
          {asset.authorVerified && (
             <div className="bg-blue-500/20 backdrop-blur-xl p-2 rounded-xl border border-blue-500/30">
               <Icons.Verified className="w-4 h-4 text-blue-400" />
             </div>
          )}
        </div>
      </div>

      {/* Info Content */}
      <div className="p-6 flex flex-col flex-grow justify-between bg-gradient-to-b from-transparent to-zinc-950/40">
        <div>
          <h3 className="text-[16px] font-black uppercase italic tracking-tight truncate glitch-hover transition-colors">
            {asset.title}
          </h3>
          <div className="flex items-center gap-3 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
            <img src={asset.authorAvatar} className="w-6 h-6 rounded-lg grayscale border border-white/10" referrerPolicy="no-referrer" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] truncate">{asset.authorName}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-5 border-t border-white/5">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} className={`w-4 h-4 transition-all ${asset.likes?.includes(currentUser?.id || '') ? 'text-brand-red scale-125' : 'text-zinc-700'}`} />
              <span className="text-[11px] font-black text-zinc-600">{asset.likes?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icons.Download className="w-4 h-4 text-zinc-700" />
              <span className="text-[11px] font-black text-zinc-600">{asset.downloadCount || 0}</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-800 tracking-tighter">HEX_{asset.id.split('-').pop()}</span>
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
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
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

  // Google Login Hook
  useEffect(() => {
    if (currentUser) return;
    const btn = document.getElementById('google-login-btn');
    if (!btn) return;

    const renderBtn = () => {
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
            localStorage.setItem('ex_session_v3', JSON.stringify(user));
          },
        });
        window.google.accounts.id.renderButton(btn, { 
          theme: 'filled_black', 
          size: 'large', 
          shape: 'pill', 
          width: 260 
        });
      }
    };

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        renderBtn();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = () => {
    if (confirm("Disconnect Unit?")) {
      setCurrentUser(null);
      localStorage.removeItem('ex_session_v3');
      window.location.reload();
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("System requires authorization for binary sync.");
    window.open(asset.fileUrl, '_blank');
    const updated = await githubStorage.incrementDownload(asset.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleLike = async (asset: Asset) => {
    if (!currentUser) return alert("System identification required.");
    const updated = await githubStorage.toggleLike(asset.id, currentUser.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim() || isExpanding) return;
    setIsExpanding(true);
    try {
      const terms = await semanticSearch(searchQuery);
      setExpandedTerms(terms);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExpanding(false);
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
      return alert("Unsupported binary format detected.");
    }
    
    setIsUploading(true);
    setUploadStep(1);
    setUploadProgress("Analyzing data DNA via Gemini AI...");
    
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
      alert("Uplink failed. Transmission lost.");
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && currentUser) list = list.filter(a => a.userId === currentUser.id);
    else if (activeTab === 'verified') list = list.filter(a => a.authorVerified);
    
    const q = searchQuery.toLowerCase();
    if (!q) return list;

    return list.filter(a => {
      const basic = a.title.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q));
      const aiMatch = expandedTerms.some(t => a.title.toLowerCase().includes(t.toLowerCase()) || a.keywords.some(k => k.toLowerCase().includes(t.toLowerCase())));
      return basic || aiMatch;
    });
  }, [assets, searchQuery, expandedTerms, activeTab, currentUser]);

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-black">
      <div className="w-20 h-20 border-t-2 border-white rounded-full animate-spin mb-10 shadow-[0_0_50px_rgba(255,255,255,0.1)]" />
      <div className="font-black uppercase tracking-[1.5em] animate-pulse text-[10px] text-zinc-500">Excalibur Protocol Init</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row max-w-[1500px] mx-auto p-6 lg:p-12 gap-12">
      
      {/* Fixed Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col glass-panel rounded-[3rem] p-10 lg:fixed h-auto lg:h-[calc(100vh-96px)] z-50 overflow-hidden border-white/5">
        <div className="flex items-center gap-5 mb-20 group cursor-default">
          <div className="w-14 h-14 bg-white rounded-[1.25rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
            <Icons.Model className="w-8 h-8 text-black" />
          </div>
          <h1 className="font-black italic text-2xl tracking-tighter">EXCALIBUR</h1>
        </div>

        <nav className="flex flex-col gap-2.5 flex-grow overflow-y-auto custom-scrollbar">
          <button onClick={() => setActiveTab('explore')} className={`sidebar-item ${activeTab === 'explore' ? 'active' : ''}`}>
             <Icons.Search className="w-5 h-5" /> <span>Registry</span>
          </button>
          <button onClick={() => setActiveTab('verified')} className={`sidebar-item ${activeTab === 'verified' ? 'active' : ''}`}>
             <Icons.Verified className="w-5 h-5" /> <span>Certified</span>
          </button>
          <button onClick={() => setActiveTab('market')} className={`sidebar-item ${activeTab === 'market' ? 'active' : ''}`}>
             <Icons.Script className="w-5 h-5" /> <span>Open Source</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}>
             <Icons.Plus className="w-5 h-5" /> <span>My Chamber</span>
          </button>
          
          {isAdmin(currentUser) && (
            <button onClick={() => setActiveTab('admin')} className={`sidebar-item mt-12 ${activeTab === 'admin' ? 'bg-brand-red text-white' : 'text-brand-red/40 hover:bg-brand-red/5 hover:text-brand-red'}`}>
               <Icons.Report className="w-5 h-5" /> <span>Root Terminal</span>
            </button>
          )}
        </nav>

        <div className="mt-10 pt-10 border-t border-white/5">
          {currentUser ? (
            <div className="flex items-center gap-5 p-5 glass-panel rounded-[2.5rem] border-none">
              <img src={currentUser.avatar} className="w-12 h-12 rounded-2xl grayscale border border-white/10" referrerPolicy="no-referrer" />
              <div className="flex-grow min-w-0">
                <p className="text-[14px] font-black truncate mb-1 leading-none">{currentUser.name}</p>
                <button onClick={handleLogout} className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest hover:text-white transition-colors">Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <p className="text-[10px] font-black uppercase text-zinc-800 tracking-widest">Identify Component</p>
              <div id="google-login-btn" className="w-full flex justify-center scale-90"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Dynamic Main Stage */}
      <main className="flex-grow lg:ml-[360px] pt-4">
        
        {/* Superior Navigation & Better Search Bar */}
        <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[1em] text-zinc-700 mb-5 italic">System // Archive</p>
            <h2 className="text-8xl font-black italic uppercase tracking-tighter leading-none glitch-hover">{activeTab}</h2>
          </div>
          
          <div className="search-wrapper group">
            <Icons.Search className={`absolute left-6 z-10 w-5 h-5 transition-colors ${searchQuery ? 'text-white' : 'text-zinc-700'}`} />
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
              placeholder="Search registry..." 
              className="search-input-fancy"
            />
            <button 
              onClick={handleAiSearch}
              disabled={isExpanding || !searchQuery}
              className="ai-search-btn"
            >
               {isExpanding ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="text-[9px] font-black z-10 uppercase tracking-widest">Gemini_Exp</span>}
            </button>
          </div>
        </header>

        {expandedTerms.length > 0 && (
          <div className="mb-12 flex flex-wrap gap-2.5 animate-fade-in p-6 glass-panel rounded-3xl border-brand-blue/20 bg-brand-blue/5">
             <div className="w-full flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-brand-blue rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase text-brand-blue tracking-[0.4em]">Semantic Expansion Active</span>
             </div>
             {expandedTerms.slice(0, 8).map(term => (
               <span key={term} className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold text-zinc-400 uppercase tracking-widest border border-white/5">
                 {term}
               </span>
             ))}
          </div>
        )}

        {/* Assets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-10">
          {filteredAssets.map(asset => (
            <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />
          ))}
          {filteredAssets.length === 0 && (
            <div className="col-span-full py-60 text-center flex flex-col items-center opacity-10">
              <Icons.Model className="w-24 h-24 mb-8" />
              <p className="text-[16px] font-black uppercase tracking-[1.5em]">No Data Found</p>
            </div>
          )}
        </div>

        {/* Fixed Action Trigger */}
        {currentUser && !currentUser.isBanned && (
          <button 
            onClick={() => setShowUpload(true)} 
            className="fixed bottom-12 right-12 w-24 h-24 bg-white text-black rounded-[2.5rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[10px] border-brand-black group animate-float overflow-hidden"
          >
            <div className="absolute inset-0 bg-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Icons.Plus className="w-10 h-10 group-hover:rotate-90 transition-transform duration-500 relative z-10" />
          </button>
        )}
      </main>

      {/* Full Inspection Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-brand-black/98 backdrop-blur-3xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-7xl glass-panel rounded-[4rem] overflow-hidden flex flex-col md:flex-row max-h-[90vh] shadow-[0_0_120px_rgba(0,0,0,0.9)] animate-fade-in border-white/10">
            {/* Visualizer Side */}
            <div className="md:w-[65%] p-10 lg:p-16 overflow-y-auto custom-scrollbar border-r border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
              <div className="aspect-video rounded-[3rem] overflow-hidden bg-black mb-14 shadow-2xl border border-white/10 relative group">
                <video src={`${selectedAsset.videoUrl}?t=${selectedAsset.timestamp}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-10 flex items-end">
                   <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.5em]">Live Hologram Protocol Active</p>
                </div>
              </div>
              <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-8 leading-tight glitch-hover">{selectedAsset.title}</h2>
              <div className="flex flex-wrap gap-3 mb-12">
                {selectedAsset.keywords?.map(k => (
                  <span key={k} className="px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-white/20 transition-all">#{k}</span>
                ))}
              </div>
              <div className="bg-black/60 rounded-[3rem] p-12 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10"><Icons.Script className="w-12 h-12" /></div>
                <p className="text-zinc-400 text-sm lg:text-base leading-relaxed whitespace-pre-wrap italic font-medium relative z-10">"{selectedAsset.description}"</p>
              </div>
            </div>

            {/* Matrix Data Side */}
            <div className="md:w-[35%] p-10 lg:p-16 flex flex-col justify-between bg-zinc-950/60">
              <div className="space-y-14">
                <div onClick={() => { setSelectedAsset(null); githubStorage.getUserProfile(selectedAsset.userId).then(d => setViewedUser(d?.user || null)); }} className="p-8 glass-panel rounded-[3rem] flex items-center gap-6 cursor-pointer hover:bg-white/[0.03] transition-all group border-white/5">
                  <img src={selectedAsset.authorAvatar} className="w-16 h-16 rounded-2xl grayscale group-hover:grayscale-0 transition-all border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[18px] font-black uppercase flex items-center gap-2 truncate">
                      {selectedAsset.authorName}
                      {selectedAsset.authorVerified && <Icons.Verified className="w-5 h-5 text-blue-400" />}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.3em] mt-2">Certified Provider</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 glass-panel rounded-[2.5rem] text-center border-white/5">
                    <p className="text-4xl font-black leading-none">{selectedAsset.downloadCount}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 mt-4">Syncs</p>
                  </div>
                  <div className="p-8 glass-panel rounded-[2.5rem] text-center border-white/5">
                    <p className="text-4xl font-black leading-none">{selectedAsset.likes?.length || 0}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 mt-4">Applause</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <button onClick={() => handleDownload(selectedAsset)} className="btn-primary-glitch w-full">
                    Initialize Sync
                  </button>
                  <div className="flex gap-4">
                    <button onClick={() => handleLike(selectedAsset)} className="flex-grow py-5 rounded-[2rem] glass-panel border-white/5 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all">
                      <Icons.Like filled={selectedAsset.likes?.includes(currentUser?.id || '')} className={`w-6 h-6 transition-transform ${selectedAsset.likes?.includes(currentUser?.id || '') ? 'text-brand-red scale-110' : 'text-zinc-700'}`} />
                      {selectedAsset.likes?.includes(currentUser?.id || '') ? 'Loved' : 'Love'}
                    </button>
                    <button onClick={() => { if(confirm("Report to Root?")) githubStorage.incrementReport(selectedAsset.id); setSelectedAsset(null); }} className="p-5 rounded-[1.5rem] glass-panel border-white/5 text-zinc-700 hover:text-brand-red transition-colors">
                      <Icons.Report className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-14 text-center">
                <p className="text-[10px] font-mono text-zinc-800 tracking-[0.4em] mb-8">UID // EXC_{selectedAsset.id.split('-').pop()}</p>
                <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[13px] font-black uppercase tracking-[0.8em] text-zinc-800 hover:text-white transition-colors">Terminate Interface</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Interface */}
      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-brand-black/99 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <div className="relative w-full max-w-5xl glass-panel rounded-[4.5rem] overflow-hidden flex flex-col max-h-[92vh] shadow-[0_0_200px_rgba(255,255,255,0.02)] animate-fade-in border-white/10">
            <header className="p-14 border-b border-white/5 flex justify-between items-center bg-black/40">
               <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center"><Icons.Plus className="w-7 h-7" /></div>
                 <h2 className="text-4xl font-black italic uppercase tracking-tighter">Transmission Setup</h2>
               </div>
               {!isUploading && (
                  <button onClick={() => setShowUpload(false)} className="w-14 h-14 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-zinc-700 hover:text-white">
                    <Icons.Plus className="w-8 h-8 rotate-45" />
                  </button>
               )}
            </header>

            <form onSubmit={handleUpload} className="p-14 space-y-14 overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-10">
                    <div>
                      <label className="text-[12px] font-black uppercase text-zinc-600 tracking-[0.4em] mb-4 block italic">Module Alias</label>
                      <input required name="title" placeholder="ENTER NAME..." className="input-terminal-fancy py-5" />
                    </div>
                    <div>
                      <label className="text-[12px] font-black uppercase text-zinc-600 tracking-[0.4em] mb-4 block italic">Sector Registry</label>
                      <select name="category" className="input-terminal-fancy py-5 appearance-none cursor-pointer">
                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-black uppercase text-zinc-600 tracking-[0.4em] mb-4 block italic">Operational Scope</label>
                    <textarea required name="desc" placeholder="DETAIL FUNCTIONALITY..." className="input-terminal-fancy h-[178px] resize-none pt-5" />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <label className="group glass-panel rounded-[3rem] p-10 h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/30">
                    <Icons.Script className="w-14 h-14 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-700 group-hover:text-white">Binary Stream</span>
                    <input required type="file" name="file" accept=".rbxm,.rbxl,.rbxmx" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-[3rem] p-10 h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/30">
                    <Icons.Model className="w-14 h-14 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-700 group-hover:text-white">Cover Meta</span>
                    <input required type="file" name="thumb" accept="image/*" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-[3rem] p-10 h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/10 hover:border-white/30">
                    <Icons.Download className="w-14 h-14 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-700 group-hover:text-white">Motion Log</span>
                    <input required type="file" name="video" accept="video/mp4" className="hidden" />
                  </label>
               </div>

               <div className="pt-12 flex justify-end items-center gap-14">
                  <button type="button" onClick={() => setShowUpload(false)} className="text-[13px] font-black uppercase tracking-[0.6em] text-zinc-800 hover:text-white transition-colors">Cancel Uplink</button>
                  <button type="submit" className="px-20 py-7 rounded-[2.5rem] bg-white text-black text-[15px] font-black uppercase tracking-[0.5em] shadow-2xl hover:bg-zinc-200 transition-all active:scale-95">Establish Link</button>
               </div>
            </form>

            {isUploading && (
              <div className="absolute inset-0 bg-brand-black/99 flex flex-col items-center justify-center p-20 z-50 text-center animate-fade-in">
                <div className="w-32 h-32 border-4 border-white/5 border-t-white rounded-full animate-spin mb-14 shadow-[0_0_80px_rgba(255,255,255,0.15)]" />
                <h3 className="text-5xl font-black italic uppercase tracking-tighter mb-6">Synchronization Active</h3>
                <p className="text-[12px] font-bold text-zinc-600 uppercase tracking-[1em] mb-20 animate-pulse">{uploadProgress}</p>
                <div className="flex gap-4 w-full max-w-[400px]">
                  {[1,2,3,4,5,6].map(i => <div key={i} className={`h-2 flex-grow rounded-full transition-all duration-1000 ${i <= uploadStep ? 'bg-white shadow-[0_0_30px_rgba(255,255,255,0.8)]' : 'bg-white/10'}`} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
