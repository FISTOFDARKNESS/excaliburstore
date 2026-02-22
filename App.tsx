
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { HeroScene } from './components/HeroScene';
import { Icons } from './constants';
import { Asset, Category, TabId, User } from './types';
import { githubService } from './services/githubService';
import { geminiService } from './services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, LogOut, Shield, CheckCircle, Download, Heart, X, Upload, FileCode, ImageIcon, Video } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

declare global {
  interface Window {
    google: any;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AssetCard: React.FC<{ asset: Asset, onClick: () => void }> = ({ asset, onClick }) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="premium-card group cursor-pointer h-full flex flex-col"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-900">
        <img 
          src={asset.thumbnailUrl} 
          alt={asset.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-md text-[8px] font-black uppercase tracking-widest text-zinc-400">
            {asset.category}
          </span>
          {asset.authorVerified && (
            <CheckCircle className="w-4 h-4 text-blue-500 fill-blue-500/20" />
          )}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-sm font-black uppercase tracking-tight text-white group-hover:text-brand-blue transition-colors truncate">
          {asset.title}
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <img src={asset.authorAvatar} className="w-4 h-4 rounded-full grayscale" referrerPolicy="no-referrer" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{asset.authorName}</span>
        </div>
        <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/5">
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-zinc-700" />
              <span className="text-[10px] font-bold text-zinc-600">{asset.likes.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3 text-zinc-700" />
              <span className="text-[10px] font-bold text-zinc-600">{asset.downloadCount}</span>
            </div>
          </div>
          <span className="text-[8px] font-mono text-zinc-800">#{asset.id.slice(-4)}</span>
        </div>
      </div>
    </motion.div>
  );
};

const MainApp = () => {
  const { user, loading: authLoading, isAdmin, login, logout } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const fetchAssets = useCallback(async () => {
    const list = await githubService.getAllAssets();
    setAssets(list.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (user) return;
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com",
          callback: async (response: any) => {
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            await login({
              id: payload.sub,
              name: payload.name,
              email: payload.email,
              avatar: payload.picture
            });
          },
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-btn'),
          { theme: 'filled_black', size: 'large', shape: 'pill', width: 240 }
        );
      }
    };
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [user, login]);

  const handleAiSearch = async () => {
    if (!searchQuery.trim() || isExpanding) return;
    setIsExpanding(true);
    try {
      const terms = await geminiService.expandQuery(searchQuery);
      setExpandedTerms(terms);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleLike = async (asset: Asset) => {
    if (!user) return alert("Identify required.");
    try {
      const updated = await githubService.toggleLike(asset.id, user.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
      if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
    } catch (err) {
      alert("Like Protocol Failed.");
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return alert("Identify required.");
    if (user.id === targetUserId) return;
    try {
      const { updatedCurrentUser } = await githubService.toggleFollow(user.id, targetUserId);
      login(updatedCurrentUser); // Update local state and storage
    } catch (err) {
      alert("Follow Protocol Failed.");
    }
  };

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (activeTab === 'profile' && user) list = list.filter(a => a.userId === user.id);
    else if (activeTab === 'verified') list = list.filter(a => a.authorVerified);
    
    const q = searchQuery.toLowerCase();
    if (!q) return list;
    
    return list.filter(a => {
      const basicMatch = a.title.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q));
      const aiMatch = expandedTerms.some(t => a.title.toLowerCase().includes(t.toLowerCase()) || a.keywords.some(k => k.toLowerCase().includes(t.toLowerCase())));
      return basicMatch || aiMatch;
    });
  }, [assets, searchQuery, expandedTerms, activeTab, user]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isUploading) return;
    
    const formData = new FormData(e.currentTarget);
    const assetFile = formData.get('file') as File;
    const thumbFile = formData.get('thumb') as File;
    const videoFile = formData.get('video') as File;
    
    if (!assetFile || !thumbFile || !videoFile) return alert("All files required.");
    
    setIsUploading(true);
    setUploadProgress("Analyzing DNA with Gemini...");
    
    try {
      const title = formData.get('title') as string;
      const desc = formData.get('desc') as string;
      const keywords = await geminiService.generateKeywords(title, desc);
      
      const toBase64 = (file: File): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      setUploadProgress("Processing Binary Data...");
      const [assetB64, thumbB64, videoB64] = await Promise.all([
        toBase64(assetFile),
        toBase64(thumbFile),
        toBase64(videoFile)
      ]);

      const asset: Asset = {
        id: `EXC-${Date.now().toString(36).toUpperCase()}`,
        userId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        authorVerified: user.isVerified,
        title,
        description: desc,
        category: formData.get('category') as Category,
        fileType: assetFile.name.slice(assetFile.name.lastIndexOf('.')) as any,
        thumbnailUrl: '',
        fileUrl: '',
        downloadCount: 0,
        likes: [],
        reports: 0,
        credits: formData.get('credits') as string,
        timestamp: Date.now(),
        keywords
      };

      setUploadProgress("Transmitting to GitHub...");
      await githubService.uploadAsset(asset, { asset: assetB64, thumb: thumbB64, video: videoB64 });
      
      setIsUploading(false);
      setShowUpload(false);
      fetchAssets();
    } catch (err) {
      console.error(err);
      alert("Transmission failed.");
      setIsUploading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row max-w-[1600px] mx-auto relative">
      <HeroScene />
      
      <aside className="w-full lg:w-72 shrink-0 flex flex-col glass-panel lg:fixed h-auto lg:h-[calc(100vh-80px)] top-10 left-10 rounded-[3rem] p-8 z-50">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
            <Shield className="w-7 h-7 text-black" />
          </div>
          <h1 className="font-black italic text-xl tracking-tighter text-white">EXCALIBUR</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <button onClick={() => setActiveTab('explore')} className={cn("sidebar-item", activeTab === 'explore' && "active")}>
            <Search className="w-5 h-5" /> <span>Explore</span>
          </button>
          <button onClick={() => setActiveTab('verified')} className={cn("sidebar-item", activeTab === 'verified' && "active")}>
            <CheckCircle className="w-5 h-5" /> <span>Verified</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={cn("sidebar-item", activeTab === 'profile' && "active")}>
            <Plus className="w-5 h-5" /> <span>My Chamber</span>
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={cn("sidebar-item mt-8 text-red-500/40 hover:bg-red-500/5", activeTab === 'admin' && "bg-red-500 text-white")}>
              <Shield className="w-5 h-5" /> <span>Root Terminal</span>
            </button>
          )}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5">
          {user ? (
            <div className="flex items-center gap-4 p-4 glass-panel rounded-[2rem] border-none bg-white/[0.03]">
              <img src={user.avatar} className="w-10 h-10 rounded-xl grayscale" referrerPolicy="no-referrer" />
              <div className="flex-grow min-w-0">
                <p className="text-[12px] font-black truncate mb-1">{user.name}</p>
                <button onClick={logout} className="text-[8px] font-black text-zinc-600 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                  <LogOut className="w-2 h-2" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <p className="text-[9px] font-black uppercase text-zinc-700 tracking-widest text-center">Protocol Identity</p>
              <div id="google-btn"></div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-grow lg:ml-80 p-6 lg:p-10 relative">
        <header className="mb-20 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
          <div className="min-w-0 flex-grow">
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-zinc-700 italic mb-4">System // Archive</p>
            <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-none truncate text-white">
              {activeTab}
            </h2>
          </div>
          <div className="search-wrapper group w-full xl:w-auto">
            <Search className={cn("absolute left-5 z-10 w-4 h-4 transition-colors", searchQuery ? "text-white" : "text-zinc-700")} />
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
              placeholder="Registry scan..." 
              className="search-input-fancy" 
            />
            <button onClick={handleAiSearch} disabled={isExpanding || !searchQuery} className="ai-search-btn">
              {isExpanding ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="text-[8px] font-black uppercase tracking-widest">Gemini_Exp</span>}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredAssets.map(asset => (
              <AssetCard key={asset.id} asset={asset} onClick={() => setSelectedAsset(asset)} />
            ))}
          </AnimatePresence>
          {filteredAssets.length === 0 && !loading && (
            <div className="col-span-full py-48 text-center flex flex-col items-center opacity-10">
              <Shield className="w-20 h-20 mb-6" />
              <p className="text-[14px] font-black uppercase tracking-[1em]">No Data Found</p>
            </div>
          )}
        </div>

        {user && !user.isBanned && (
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUpload(true)} 
            className="fixed bottom-10 right-10 w-20 h-20 bg-white text-black rounded-[2rem] shadow-2xl flex items-center justify-center z-40 border-[8px] border-black group"
          >
            <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
          </motion.button>
        )}
      </main>

      {/* Asset Details Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setSelectedAsset(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl glass-panel rounded-[3.5rem] overflow-hidden flex flex-col md:flex-row max-h-[85vh]"
            >
              <div className="md:w-[65%] p-10 overflow-y-auto custom-scrollbar border-r border-white/5">
                <div className="aspect-video rounded-[2.5rem] overflow-hidden bg-black mb-10 border border-white/10">
                  <video src={selectedAsset.videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6 text-white">{selectedAsset.title}</h2>
                <div className="flex flex-wrap gap-2 mb-8">
                  {selectedAsset.keywords.map(k => <span key={k} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-zinc-500">#{k}</span>)}
                </div>
                <div className="bg-black/60 rounded-[2rem] p-8 border border-white/5">
                  <p className="text-zinc-400 text-sm italic font-medium">"{selectedAsset.description}"</p>
                </div>
              </div>
              <div className="md:w-[35%] p-10 flex flex-col justify-between bg-zinc-950/40">
                <div className="space-y-10">
                  <div className="p-6 glass-panel rounded-[2rem] flex items-center gap-4 border-none bg-white/[0.03]">
                    <img src={selectedAsset.authorAvatar} className="w-12 h-12 rounded-xl border border-white/10 grayscale" referrerPolicy="no-referrer" />
                    <div className="min-w-0 flex-grow">
                      <p className="text-[14px] font-black uppercase truncate flex items-center gap-2 text-white">
                        {selectedAsset.authorName} {selectedAsset.authorVerified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Verified Unit</p>
                    </div>
                    {user && user.id !== selectedAsset.userId && (
                      <button 
                        onClick={() => handleFollow(selectedAsset.userId)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                          user.following.includes(selectedAsset.userId) 
                            ? "bg-white/10 text-white border border-white/10" 
                            : "bg-white text-black hover:scale-105"
                        )}
                      >
                        {user.following.includes(selectedAsset.userId) ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 glass-panel rounded-3xl text-center border-white/5">
                      <p className="text-3xl font-black leading-none text-white">{selectedAsset.downloadCount}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 mt-2">Syncs</p>
                    </div>
                    <button 
                      onClick={() => handleLike(selectedAsset)}
                      className={cn(
                        "p-6 glass-panel rounded-3xl text-center transition-all",
                        selectedAsset.likes.includes(user?.id || '') ? "border-red-500/50 bg-red-500/5" : "border-white/5"
                      )}
                    >
                      <p className={cn("text-3xl font-black leading-none", selectedAsset.likes.includes(user?.id || '') ? "text-red-500" : "text-white")}>
                        {selectedAsset.likes.length}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700 mt-2">Loves</p>
                    </button>
                  </div>
                  <button onClick={() => window.open(selectedAsset.fileUrl)} className="btn-primary-glitch w-full">Sync Binary</button>
                </div>
                <button onClick={() => setSelectedAsset(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-800 hover:text-white transition-colors">Abort Interaction</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-8"
          >
            <div className="absolute inset-0 bg-black/99 backdrop-blur-3xl" onClick={() => !isUploading && setShowUpload(false)} />
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-4xl glass-panel rounded-[4rem] overflow-hidden flex flex-col max-h-[90vh] border-white/10"
            >
              <header className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Transmission Uplink</h2>
                {!isUploading && (
                  <button onClick={() => setShowUpload(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-zinc-700 hover:text-white">
                    <X className="w-7 h-7" />
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
                    <FileCode className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 text-white" />
                    <span className="text-[9px] font-black uppercase text-zinc-700 group-hover:text-white">Binary</span>
                    <input required type="file" name="file" accept=".rbxm,.rbxl,.rbxmx" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-3xl p-8 h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/20">
                    <ImageIcon className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 text-white" />
                    <span className="text-[9px] font-black uppercase text-zinc-700 group-hover:text-white">Visual</span>
                    <input required type="file" name="thumb" accept="image/*" className="hidden" />
                  </label>
                  <label className="group glass-panel rounded-3xl p-8 h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all border-dashed border-white/20">
                    <Video className="w-10 h-10 mb-4 opacity-20 group-hover:opacity-100 text-white" />
                    <span className="text-[9px] font-black uppercase text-zinc-700 group-hover:text-white">Motion</span>
                    <input required type="file" name="video" accept="video/mp4" className="hidden" />
                  </label>
                </div>
                <div className="pt-8 flex justify-end items-center gap-10">
                  <button type="button" onClick={() => setShowUpload(false)} className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-800 hover:text-white transition-colors">Abort</button>
                  <button type="submit" className="btn-primary-glitch">Initiate Sync</button>
                </div>
              </form>
              {isUploading && (
                <div className="absolute inset-0 bg-black/99 flex flex-col items-center justify-center p-16 z-50 text-center">
                  <div className="w-20 h-20 border-t-2 border-white rounded-full animate-spin mb-10" />
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-white">Transmitting...</h3>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.8em] animate-pulse">{uploadProgress}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
