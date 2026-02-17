
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Asset, User, Category, RobloxFileType, TabId } from './types';
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

  // Forçamos o recarregamento do thumbnail com timestamp atual para evitar cache
  const thumbUrl = `${asset.thumbnailUrl}?t=${Date.now()}`;
  const videoUrl = asset.videoUrl ? `${asset.videoUrl}?t=${Date.now()}` : '';

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`premium-card h-[380px] flex flex-col group cursor-pointer ${asset.reports > 5 ? 'grayscale opacity-30 pointer-events-none' : ''}`}
    >
      <div className="h-[220px] relative overflow-hidden bg-black">
        <img 
          src={thumbUrl} 
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${isHovered && videoUrl ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}
          alt={asset.title}
        />
        {videoUrl && (
          <video 
            ref={videoRef}
            src={videoUrl} 
            muted 
            loop 
            playsInline 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`} 
          />
        )}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="bg-black/90 backdrop-blur-xl px-3 py-1 rounded-lg border border-white/10 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            {asset.category}
          </div>
          {asset.authorVerified && (
             <div className="bg-blue-500/20 backdrop-blur-xl p-1.5 rounded-lg border border-blue-500/30">
               <Icons.Verified className="w-3.5 h-3.5 text-blue-400" />
             </div>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow justify-between">
        <div>
          <h3 className={`text-[15px] font-black uppercase italic tracking-tight truncate transition-colors ${isHovered ? 'text-white' : 'text-zinc-200'}`}>
            {asset.title}
          </h3>
          <div className="flex items-center gap-3 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
            <img src={asset.authorAvatar} className="w-5 h-5 rounded-md grayscale border border-white/10" referrerPolicy="no-referrer" />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">{asset.authorName}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-white/5">
          <div className="flex gap-5">
            <div className="flex items-center gap-1.5">
              <Icons.Like filled={asset.likes?.includes(currentUser?.id || '')} className={`w-4 h-4 ${asset.likes?.includes(currentUser?.id || '') ? 'text-brand-red' : 'text-zinc-700'}`} />
              <span className="text-[10px] font-black text-zinc-600">{asset.likes?.length || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icons.Download className="w-4 h-4 text-zinc-700" />
              <span className="text-[10px] font-black text-zinc-600">{asset.downloadCount || 0}</span>
            </div>
          </div>
          <span className="text-[8px] font-mono text-zinc-800 tracking-tighter">HEX_{asset.id.split('-').pop()}</span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStep, setUploadStep] = useState(0);

  const isAdmin = (user: User | null) => user ? (user.isAdmin || ADMIN_EMAILS.includes(user.email)) : false;

  const syncRegistry = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const list = await githubStorage.getAllAssets();
      setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { 
      console.error(e); 
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await syncRegistry();
      const session = localStorage.getItem('ex_session_v5');
      if (session) {
        try {
          const u = JSON.parse(session);
          const fresh = await githubStorage.getUserProfile(u.id);
          if (fresh && !fresh.user.isBanned) {
            setCurrentUser(fresh.user);
          } else {
            localStorage.removeItem('ex_session_v5');
          }
        } catch { localStorage.removeItem('ex_session_v5'); }
      }
      setLoading(false);
    };
    init();
  }, [syncRegistry]);

  useEffect(() => {
    if (currentUser) return;
    const renderBtn = () => {
      const btn = document.getElementById('google-login-btn');
      if (btn && window.google?.accounts?.id) {
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
            localStorage.setItem('ex_session_v5', JSON.stringify(user));
          },
        });
        window.google.accounts.id.renderButton(btn, { theme: 'filled_black', size: 'large', shape: 'pill', width: 220 });
      }
    };
    const interval = setInterval(() => { if (window.google?.accounts?.id) { renderBtn(); clearInterval(interval); } }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = () => { if (confirm("Terminate Session?")) { setCurrentUser(null); localStorage.removeItem('ex_session_v5'); window.location.reload(); } };

  const handleAiSearch = async () => {
    if (!searchQuery.trim() || isExpanding) return;
    setIsExpanding(true);
    try {
      const terms = await semanticSearch(searchQuery);
      setExpandedTerms(terms);
    } catch (e) { console.error(e); } finally { setIsExpanding(false); }
  };

  const handleDownload = async (asset: Asset) => {
    if (!currentUser) return alert("Identify required.");
    // Forçamos o download com no-cache dinâmico
    const finalUrl = `${asset.fileUrl}?t=${Date.now()}`;
    window.open(finalUrl, '_blank');
    const updated = await githubStorage.incrementDownload(asset.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleLike = async (asset: Asset) => {
    if (!currentUser) return alert("Identify required.");
    const updated = await githubStorage.toggleLike(asset.id, currentUser.id);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;
    if (!ALLOWED_ROBLOX_EXTENSIONS.some(ext => assetFile.name.toLowerCase().endsWith(ext))) return alert("Invalid Format.");
    setIsUploading(true); setUploadStep(1); setUploadProgress("AI Analyzing DNA...");
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
      await githubStorage.uploadAsset(asset, { asset: assetFile, thumb: thumbFile, video: videoFile }, (msg) => { setUploadProgress(msg); setUploadStep(prev => Math.min(prev + 1, 6)); });
      setIsUploading(false); setShowUpload(false); setUploadStep(0); syncRegistry(true);
    } catch (err) { alert("Uplink Failed."); setIsUploading(false); }
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
      <div className="w-16 h-16 border-t-2 border-white rounded-full animate-spin mb-8 shadow-2xl" />
      <p className="text-[10px] font-black uppercase tracking-[1em] animate-pulse text-zinc-600">Syncing Protocol</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row max-w-[1600px] mx-auto">
      
      {/* Sidebar */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col glass-panel lg:fixed h-auto lg:h-[calc(100vh-80px)] top-10 left-10 rounded-[3rem] p-8 z-50 border-white/5">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
            <Icons.Model className="w-7 h-7 text-black" />
          </div>
          <h1 className="font-black italic text-xl tracking-tighter text-white">EXCALIBUR</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <button onClick={() => setActiveTab('explore')} className={`sidebar-item ${activeTab === 'explore' ? 'active' : ''}`}>
             <Icons.Search className="w-5 h-5 shrink-0" /> <span>Registry</span>
          </button>
          <button onClick={() => setActiveTab('verified')} className={`sidebar-item ${activeTab === 'verified' ? 'active' : ''}`}>
             <Icons.Verified className="w-5 h-5 shrink-0" /> <span>Certified</span>
          </button>
          <button onClick={() => setActiveTab('market')} className={`sidebar-item ${activeTab === 'market' ? 'active' : ''}`}>
             <Icons.Script className="w-5 h-5 shrink-0" /> <span>Open Source</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}>
             <Icons.Plus className="w-5 h-5 shrink-0" /> <span>My Chamber</span>
          </button>
          {isAdmin(currentUser) && (
            <button onClick={() => setActiveTab('admin')} className={`sidebar-item mt-8 ${activeTab === 'admin' ? 'bg-brand-red text-white' : 'text-red-500/40 hover:bg-red-500/5'}`}>
               <Icons.Report className="w-5 h-5 shrink-0" /> <span>Root Terminal</span>
            </button>
          )}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="flex items-center gap-4 p-4 glass-panel rounded-[2rem] border-none bg-white/[0.03]">
              <img src={currentUser.avatar} className="w-10 h-10 rounded-xl grayscale border border-white/10" referrerPolicy="no-referrer" />
              <div className="flex-grow min-w-0">
                <p className="text-[12px] font-black truncate leading-none mb-1.5">{currentUser.name}</p>
                <button onClick={handleLogout} className="text-[8px] font-black text-zinc-600 uppercase tracking-widest hover:text-white transition-colors">Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <p className="text-[9px] font-black uppercase text-zinc-700 tracking-widest text-center">Protocol Identity</p>
              <div id="google-login-btn" className="w-full flex justify-center"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Layout Area */}
      <main className="flex-grow lg:ml-80 p-6 lg:p-10">
        
        <header className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-4 mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.6em] text-zinc-700 italic">System // Archive</p>
              <button 
                onClick={() => syncRegistry(true)} 
                className={`flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all ${isRefreshing ? 'animate-pulse' : ''}`}
              >
                {isRefreshing ? 'Syncing...' : 'Force Sync'}
              </button>
            </div>
            <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-none glitch-text">{activeTab}</h2>
          </div>
          
          <div className="search-wrapper group">
            <Icons.Search className={`absolute left-5 z-10 w-4 h-4 transition-colors ${searchQuery ? 'text-white' : 'text-zinc-700'}`} />
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
              placeholder="Registry scan..." 
              className="search-input-fancy"
            />
            <button 
              onClick={handleAiSearch}
              disabled={isExpanding || !searchQuery}
              className="ai-search-btn"
            >
               {isExpanding ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="text-[8px] font-black uppercase tracking-widest">Gemini_Exp</span>}
            </button>
          </div>
        </header>

        <div className="animate-fade-in">
          {expandedTerms.length > 0 && (
            <div className="mb-10 flex flex-wrap gap-2 p-4 glass-panel rounded-2xl border-brand-blue/20 bg-brand-blue/5">
               {expandedTerms.slice(0, 6).map(term => <span key={term} className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-zinc-500 uppercase">#{term}</span>)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredAssets.map(asset => (
              <AssetCard key={asset.id} asset={asset} currentUser={currentUser} onClick={() => setSelectedAsset(asset)} />
            ))}
            {filteredAssets.length === 0 && (
              <div className="col-span-full py-48 text-center flex flex-col items-center opacity-10">
                <Icons.Model className="w-20 h-20 mb-6" />
                <p className="text-[14px] font-black uppercase tracking-[1em]">No Data Found</p>
              </div>
            )}
          </div>
        </div>

        {currentUser && !currentUser.isBanned && (
          <button 
            onClick={() => setShowUpload(true)} 
            className="fixed bottom-10 right-10 w-20 h-20 bg-white text-black rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-[8px] border-brand-black group"
          >
            <Icons.Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        )}
      </main>

      {/* Asset Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-brand-black/98 backdrop-blur-3xl" onClick={() => setSelectedAsset(null)} />
          <div className="relative w-full max-w-6xl glass-panel rounded-[3.5rem] overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-fade-in">
            <div className="md:w-[65%] p-10 overflow-y-auto custom-scrollbar border-r border-white/5">
              <div className="aspect-video rounded-[2.5rem] overflow-hidden bg-black mb-10 border border-white/10 group">
                <video src={`${selectedAsset.videoUrl}?t=${Date.now()}`} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6">{selectedAsset.title}</h2>
              <div className="flex flex-wrap gap-2 mb-8">
                {selectedAsset.keywords?.map(k => <span key={k} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-zinc-500">#{k}</span>)}
              </div>
              <div className="bg-black/60 rounded-[2rem] p-8 border border-white/5">
                <p className="text-zinc-400 text-sm italic font-medium">"{selectedAsset.description}"</p>
              </div>
            </div>
            <div className="md:w-[35%] p-10 flex flex-col justify-between bg-zinc-950/40">
              <div className="space-y-10">
                <div onClick={() => { setSelectedAsset(null); }} className="p-6 glass-panel rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all group">
                  <img src={selectedAsset.authorAvatar} className="w-12 h-12 rounded-xl border border-white/10 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-black uppercase truncate flex items-center gap-2">
                      {selectedAsset.authorName} {selectedAsset.authorVerified && <Icons.Verified className="w-4 h-4 text-blue-400" />}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Verified Unit</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 glass-panel rounded-3xl text-center border-white/5">
                    <p className="text-3xl font-black leading-none">{selectedAsset.downloadCount}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 mt-2">Syncs</p>
                  </div>
                  <div className="p-6 glass-panel rounded-3xl text-center border-white/5">
                    <p className="text-3xl font-black leading-none">{selectedAsset.likes?.length || 0}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 mt-2">Loves</p>
                  </div>
                </div>
                <button onClick={() => handleDownload(selectedAsset)} className="btn-primary-glitch w-full">Sync Binary</button>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-800 hover:text-white transition-colors">Abort Interaction</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-brand-black/99 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
          <div className="relative w-full max-w-4xl glass-panel rounded-[4rem] overflow-hidden flex flex-col max-h-[90vh] animate-fade-in border-white/10">
            <header className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40">
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Transmission Uplink</h2>
               {!isUploading && (
                  <button onClick={() => setShowUpload(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-zinc-700 hover:text-white">
                    <Icons.Plus className="w-7 h-7 rotate-45" />
                  </button>
               )}
            </header>
            <form onSubmit={handleUpload} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-3 block italic">Label</label>
                      <input required name="title" placeholder="ALIAS..." className="input-terminal-fancy" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-3 block italic">Sector</label>
                      <select name="category" className="input-terminal-fancy appearance-none">
                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-3 block italic">Logs</label>
                    <textarea required name="desc" placeholder="FUNCTIONAL DETAILS..." className="input-terminal-fancy h-[132px] resize-none" />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <label className="group glass-panel rounded-3xl p-8 h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/20">
                    <Icons.Script className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Binary</span>
                    <input required type="file" name="file" accept=".rbxm,.rbxl,.rbxmx" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-3xl p-8 h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/20">
                    <Icons.Model className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Visual</span>
                    <input required type="file" name="thumb" accept="image/*" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-3xl p-8 h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/20">
                    <Icons.Download className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700 group-hover:text-white">Motion</span>
                    <input required type="file" name="video" accept="video/mp4" className="hidden" />
                  </label>
               </div>
               <div className="pt-8 flex justify-end items-center gap-10">
                  <button type="button" onClick={() => setShowUpload(false)} className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-800 hover:text-white transition-colors">Abort</button>
                  <button type="submit" className="btn-primary-glitch">Initiate Sync</button>
               </div>
            </form>
            {isUploading && (
              <div className="absolute inset-0 bg-brand-black/99 flex flex-col items-center justify-center p-16 z-50 text-center animate-fade-in">
                <div className="w-20 h-20 border-t-2 border-white rounded-full animate-spin mb-10" />
                <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-white">Transmitting...</h3>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.8em] animate-pulse">{uploadProgress}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
