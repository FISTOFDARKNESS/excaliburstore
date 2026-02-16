
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, User, Comment, Category } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";

// --- Helpers ---
const getEmbedUrl = (url: string) => {
  if (!url) return null;
  if (url.startsWith('data:video/')) return url;
  
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(ytRegex);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return null;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

// --- Components ---

const LoginMenu = ({ onClose }: { 
  onClose: () => void
}) => {
  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.renderButton(
        document.getElementById("google-login-btn-container"),
        { theme: "outline", size: "large", width: "320", shape: "pill", text: "continue_with" }
      );
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">Identity Access</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Login via Google to access BloxMarket</p>
        </div>
        <div className="space-y-4 pt-4">
          <div id="google-login-btn-container" className="flex justify-center transition-all hover:scale-105" />
        </div>
        <button onClick={onClose} className="w-full text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] hover:text-white transition-colors">Cancel</button>
      </div>
    </div>
  );
};

const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  user, 
  onOpenLogin,
  onLogout 
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void; 
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}) => (
  <aside className="w-72 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-8 z-50 bg-[#050505] transition-colors">
    <div className="flex items-center gap-3 mb-12">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)]">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
        </svg>
      </div>
      <span className="font-black uppercase tracking-tighter text-xl italic text-white">EXCALIBUR</span>
    </div>

    <nav className="flex-grow space-y-3">
      {[
        { id: 'home', label: 'MARKET HUB', icon: <Icons.Model /> },
        { id: 'library', label: 'MY FILES', icon: <Icons.Script /> },
        { id: 'profile', label: 'MY IDENTITY', icon: <Icons.Plus /> },
        { id: 'history', label: 'HISTORY', icon: <Icons.Script /> }
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center gap-4 px-5 py-3 text-[11px] font-black tracking-widest transition-all ${
            activeTab === item.id ? 'sidebar-link-active' : 'text-zinc-600 hover:text-white'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>

    <div className="mt-auto space-y-4">
      {user ? (
        <div className="p-4 premium-card rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" alt="avatar" />
            <div className="flex-grow min-w-0">
              <p className="text-xs font-bold truncate text-white">@{user.username}</p>
              <div className="flex gap-2 text-[9px] text-zinc-500 font-black uppercase">
                <span>{user.followers.length} Followers</span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="w-full text-[10px] bg-white/5 py-2 rounded-lg text-zinc-400 hover:text-white uppercase font-black transition-all">Sign Out</button>
        </div>
      ) : (
        <button 
          onClick={onOpenLogin}
          className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[11px] tracking-widest hover:brightness-110 transition-all"
        >
          LOGIN
        </button>
      )}
      <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-5 py-3 text-[11px] font-black tracking-widest transition-all ${activeTab === 'settings' ? 'text-white' : 'text-zinc-600 hover:text-white'}`}>
        <Icons.Plus />
        SETTINGS
      </button>
    </div>
  </aside>
);

const AssetRow = ({ asset, onClick, onDownload, onAuthorClick }: { asset: Asset, onClick: (a: Asset) => void, onDownload: (a: Asset) => void, onAuthorClick?: (uid: string) => void }) => (
  <div 
    onClick={() => onClick(asset)}
    className="premium-card rounded-[32px] p-5 flex items-center gap-6 cursor-pointer group w-full"
  >
    <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={asset.title} />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
      {asset.creditsRequired && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-1 rounded-md uppercase">Credits Needed</div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-xl text-white truncate group-hover:text-blue-400 transition-colors tracking-tight">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }}
          className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-colors"
        >
          {asset.authorName}
        </button>
        <span className="text-zinc-800">•</span>
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-2">
      <button 
        onClick={(e) => { e.stopPropagation(); onDownload(asset); }}
        className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
      >
        GET FILE
      </button>
      {asset.reports.length > 0 && (
         <span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest">{asset.reports.length} Reports</span>
      )}
    </div>
  </div>
);

const AssetDetailModal: React.FC<{
  asset: Asset;
  onClose: () => void;
  currentUser: User | null;
  onLike: (id: string) => void;
  onDownload: (asset: Asset) => void;
  onAuthorClick: (uid: string) => void;
  onReport: (id: string) => void;
}> = ({ asset, onClose, currentUser, onLike, onDownload, onAuthorClick, onReport }) => {
  const embedUrl = getEmbedUrl(asset.videoUrl || '');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        <div className="flex-grow overflow-y-auto custom-scrollbar p-10 space-y-8">
          <div className="aspect-video w-full rounded-[32px] overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl relative">
            {embedUrl ? (
              <iframe 
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : asset.videoUrl ? (
               <video src={asset.videoUrl} className="w-full h-full object-contain" controls autoPlay loop muted />
            ) : (
              <img src={asset.thumbnailUrl} className="w-full h-full object-cover" alt={asset.title} />
            )}
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black tracking-tighter uppercase text-white">{asset.title}</h2>
            <p className="text-zinc-500 text-sm leading-relaxed whitespace-pre-line">{asset.description}</p>
          </div>
        </div>
        <div className="w-full md:w-[320px] bg-[#0a0a0a] border-l border-white/5 p-10 flex flex-col shrink-0">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => onReport(asset.id)}
              className="text-[9px] font-black uppercase text-zinc-700 hover:text-red-500 transition-colors tracking-widest flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              Report Asset
            </button>
            <button onClick={onClose} className="p-2 text-zinc-600 hover:text-white transition-transform hover:rotate-90">
              <Icons.Plus />
            </button>
          </div>
          <div className="flex-grow mt-10 space-y-6">
            <button 
              onClick={() => onAuthorClick(asset.userId)}
              className="w-full p-4 premium-card rounded-2xl flex items-center gap-4 hover:border-white/20 transition-all text-left group/author"
            >
              <img src={asset.authorAvatar} className="w-10 h-10 rounded-full border border-white/10" alt="avatar" />
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-black text-white truncate group-hover/author:text-blue-400">@{asset.authorName}</p>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Creator</p>
              </div>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 premium-card rounded-2xl text-center">
                <p className="text-[8px] font-black text-zinc-700 uppercase">Downloads</p>
                <p className="text-lg font-black text-white">{asset.downloadCount}</p>
              </div>
              <div className="p-4 premium-card rounded-2xl text-center">
                <p className="text-[8px] font-black text-zinc-700 uppercase">Format</p>
                <p className="text-lg font-black text-blue-500">{asset.fileType}</p>
              </div>
            </div>
            {asset.creditsRequired && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest text-center">CREDITS REQUIRED IN GAME</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => onDownload(asset)}
            className="w-full bg-white text-black font-black uppercase py-5 rounded-[24px] text-xs tracking-[0.3em] mt-10 hover:brightness-110 active:scale-95 transition-all shadow-xl"
          >
            GET FILE
          </button>
        </div>
      </div>
    </div>
  );
};

const PublishModal = ({ onClose, onPublish }: { onClose: () => void, onPublish: (a: Partial<Asset>) => void }) => {
  const [formData, setFormData] = useState<Partial<Asset>>({
    title: '',
    description: '',
    category: Category.MODEL,
    fileType: '.rbxm',
    creditsRequired: false,
    thumbnailUrl: '',
    videoUrl: '',
    fileData: ''
  });

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const rbxInputRef = useRef<HTMLInputElement>(null);

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setFormData(prev => ({ ...prev, thumbnailUrl: base64 }));
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setFormData(prev => ({ ...prev, videoUrl: base64 }));
    }
  };

  const handleRbxFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.substring(file.name.lastIndexOf('.'));
      if (['.rbxm', '.rbxl', '.rbxmx'].includes(extension)) {
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, fileData: base64, fileType: extension as any }));
      } else {
        alert("Invalid file type! Please upload .rbxm, .rbxl, or .rbxmx");
        e.target.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.thumbnailUrl) {
        alert("Please upload a thumbnail image.");
        return;
    }
    if (!formData.fileData) {
        alert("Please upload the Roblox file (.rbxm, .rbxl, or .rbxmx).");
        return;
    }
    onPublish(formData);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">Publish New Asset</h2>
          <button onClick={onClose} className="p-2 text-zinc-600 hover:text-white transition-transform hover:rotate-90">
            <Icons.Plus />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Asset Title</label>
            <input 
              required
              type="text" 
              placeholder="Ex: Advanced Hoverboard System"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20 transition-all"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Roblox File (.rbxm, .rbxl, .rbxmx)</label>
            <input 
              type="file"
              accept=".rbxm,.rbxl,.rbxmx"
              ref={rbxInputRef}
              onChange={handleRbxFileUpload}
              className="hidden"
            />
            <button 
              type="button"
              onClick={() => rbxInputRef.current?.click()}
              className={`w-full p-4 rounded-2xl border flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest transition-all ${
                formData.fileData ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-600 hover:text-white hover:border-white/20'
              }`}
            >
              {formData.fileData ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  File Attached ({formData.fileType})
                </>
              ) : "Select Roblox File *"}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Description</label>
            <textarea 
              required
              placeholder="Tell people what makes this asset special..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20 transition-all min-h-[120px] resize-none"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Category</label>
              <select 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20 transition-all appearance-none"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
              >
                {Object.values(Category).map(cat => (
                  <option key={cat} value={cat} className="bg-black">{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Thumbnail</label>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={thumbInputRef}
                onChange={handleThumbUpload}
              />
              <button 
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                className="w-full bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 text-zinc-500 hover:text-white hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden min-h-[100px]"
              >
                {formData.thumbnailUrl ? (
                    <img src={formData.thumbnailUrl} className="w-full h-16 object-cover rounded-lg" alt="preview" />
                ) : (
                    <>
                        <div className="w-8 h-8 opacity-20"><Icons.Plus /></div>
                        <span className="text-[9px] font-black uppercase tracking-widest">Select Image *</span>
                    </>
                )}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Showcase Video</label>
              <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                ref={videoInputRef}
                onChange={handleVideoUpload}
              />
              <button 
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="w-full bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 text-zinc-500 hover:text-white hover:border-white/20 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden min-h-[100px]"
              >
                {formData.videoUrl ? (
                    <div className="flex items-center gap-2 text-blue-400">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Video Loaded</span>
                    </div>
                ) : (
                    <>
                        <div className="w-8 h-8 opacity-20"><Icons.Plus /></div>
                        <span className="text-[9px] font-black uppercase tracking-widest">Select Video</span>
                    </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 premium-card rounded-2xl">
            <input 
              type="checkbox" 
              id="credits"
              className="w-5 h-5 accent-white rounded"
              checked={formData.creditsRequired}
              onChange={e => setFormData({ ...formData, creditsRequired: e.target.checked })}
            />
            <label htmlFor="credits" className="text-xs font-black uppercase tracking-widest text-white cursor-pointer select-none">Require credits in my game</label>
          </div>

          <button 
            type="submit"
            className="w-full bg-white text-black font-black uppercase py-6 rounded-[24px] text-sm tracking-[0.3em] mt-4 hover:brightness-110 active:scale-95 transition-all shadow-xl"
          >
            CONFIRM PUBLICATION
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Root App ---

export default function App() {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('blox_users_v3');
    return saved ? JSON.parse(saved) : MOCK_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('blox_user_v3');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('blox_assets_v3');
    return saved ? JSON.parse(saved) : MOCK_ASSETS.map(a => ({...a, reports: []}));
  });

  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('blox_theme') || 'default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [historyIds, setHistoryIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('blox_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Initialize Google Identity Services
  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('blox_users_v3', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('blox_user_v3', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('blox_assets_v3', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('blox_theme', theme);
  }, [theme]);

  const handleGoogleSignIn = (response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) {
      console.error("Failed to decode JWT");
      return;
    }

    const existingUser = users.find(u => u.id === payload.sub);
    
    if (existingUser) {
      setCurrentUser(existingUser);
    } else {
      const newUser: User = {
        id: payload.sub,
        name: payload.name,
        username: payload.email.split('@')[0],
        avatar: payload.picture,
        provider: 'google',
        followers: [],
        following: [],
        bio: "Just joined BloxMarket!",
        links: []
      };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
    }
    setShowLoginMenu(false);
  };

  const handleLogout = () => {
    if ((window as any).google) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
    setCurrentUser(null);
    localStorage.removeItem('blox_user_v3');
    setActiveTab('home');
    setViewingUserId(null);
  };

  const handleFollow = (targetId: string) => {
    if (!currentUser) {
      setShowLoginMenu(true);
      return;
    }
    if (currentUser.id === targetId) return;

    const isFollowing = currentUser.following.includes(targetId);

    setUsers(prev => prev.map(u => {
      if (u.id === targetId) {
        const followers = isFollowing 
          ? u.followers.filter(id => id !== currentUser.id)
          : [...u.followers, currentUser.id];
        return { ...u, followers };
      }
      if (u.id === currentUser.id) {
        const following = isFollowing
          ? u.following.filter(id => id !== targetId)
          : [...u.following, targetId];
        const updated = { ...u, following };
        setCurrentUser(updated);
        return updated;
      }
      return u;
    }));
  };

  const handleReport = (assetId: string) => {
    if (!currentUser) {
      setShowLoginMenu(true);
      return;
    }
    setAssets(prev => prev.map(a => {
      if (a.id === assetId && !a.reports.includes(currentUser.id)) {
        alert("Report submitted. Our moderation team will review this file.");
        return { ...a, reports: [...a.reports, currentUser.id] };
      }
      return a;
    }));
  };

  const handleDownload = (asset: Asset) => {
    if (!currentUser) {
      setShowLoginMenu(true);
      return;
    }
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a));
    
    // Use uploaded file data if available, otherwise mock it
    const data = asset.fileData || `RBX_ASSET_CONTENT: ${asset.title}\nFORMAT: ${asset.fileType}`;
    
    if (asset.fileData) {
      const link = document.createElement('a');
      link.href = asset.fileData;
      link.setAttribute('download', `${asset.title.replace(/\s+/g, '_')}${asset.fileType}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${asset.title.replace(/\s+/g, '_')}${asset.fileType}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const onAssetClick = (a: Asset) => {
    setSelectedAssetId(a.id);
    setHistoryIds(prev => [a.id, ...prev.filter(id => id !== a.id)].slice(0, 15));
  };

  const onAuthorClick = (uid: string) => {
    setViewingUserId(uid);
    setActiveTab('profile');
    setSelectedAssetId(null);
  };

  const handlePublish = (data: Partial<Asset>) => {
    if (!currentUser) return;
    const newAsset: Asset = {
      id: 'a_' + Date.now(),
      userId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      title: data.title || 'Untitled Asset',
      description: data.description || '',
      category: data.category || Category.MODEL,
      thumbnailUrl: data.thumbnailUrl || 'https://picsum.photos/seed/default/800/450',
      videoUrl: data.videoUrl,
      fileType: data.fileType as any || '.rbxm',
      fileData: data.fileData,
      creditsRequired: !!data.creditsRequired,
      likes: [],
      dislikes: [],
      reports: [],
      comments: [],
      downloadCount: 0,
      timestamp: Date.now()
    };

    const updatedAssets = [newAsset, ...assets];
    setAssets(updatedAssets);
    setShowPublishModal(false);
  };

  const handleUpdateProfile = (bio: string, link1Label: string, link1Url: string, link2Label: string, link2Url: string) => {
    if (!currentUser) return;
    const updatedLinks = [];
    if (link1Label && link1Url) updatedLinks.push({ label: link1Label, url: link1Url });
    if (link2Label && link2Url) updatedLinks.push({ label: link2Label, url: link2Url });

    const updated = {
      ...currentUser,
      bio,
      links: updatedLinks
    };
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
  };

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    return assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [assets, searchQuery]);

  const historyAssets = useMemo(() => {
    return historyIds.map(id => assets.find(a => a.id === id)).filter(Boolean) as Asset[];
  }, [assets, historyIds]);

  const userAssets = useMemo(() => {
    return currentUser ? assets.filter(a => a.userId === currentUser.id) : [];
  }, [assets, currentUser]);

  const currentSelectedAsset = useMemo(() => {
    return assets.find(a => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  const targetUser = useMemo(() => {
    const id = viewingUserId || (activeTab === 'profile' ? currentUser?.id : null);
    if (!id) return null;
    return users.find(u => u.id === id) || null;
  }, [users, viewingUserId, currentUser, activeTab]);

  const targetAssets = useMemo(() => {
    if (!targetUser) return [];
    return assets.filter(a => a.userId === targetUser.id);
  }, [targetUser, assets]);

  return (
    <div className="flex bg-[var(--bg-color)] min-h-screen">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setViewingUserId(null); }} 
        user={currentUser}
        onOpenLogin={() => setShowLoginMenu(true)}
        onLogout={handleLogout}
      />

      {activeTab === 'home' ? (
        <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar px-20 pt-32 pb-24 relative">
          <div className="glow-accent" />
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter text-white">Explore</h1>
            <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter text-ghost mb-16">Global Hub</h1>
            <div className="w-full relative">
               <input 
                type="text" 
                placeholder="Search assets..." 
                className="w-full search-pill rounded-full py-8 px-12 text-2xl font-semibold focus:outline-none focus:border-white/20 transition-all text-center mb-24 placeholder:text-zinc-800"
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full space-y-5">
              {filteredAssets.map(a => (
                <AssetRow 
                  key={a.id} 
                  asset={a} 
                  onClick={onAssetClick} 
                  onDownload={handleDownload} 
                  onAuthorClick={onAuthorClick}
                />
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'library' ? (
        <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar px-20 pt-32 pb-24 relative">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-16">
              <div>
                <h1 className="text-6xl font-black uppercase tracking-tighter italic text-white leading-none">My Files</h1>
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600 mt-4">Personal Asset Repository</p>
              </div>
              {currentUser && (
                <button 
                  onClick={() => setShowPublishModal(true)}
                  className="bg-white text-black px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-2xl flex items-center gap-2"
                >
                  <Icons.Plus />
                  Publish New
                </button>
              )}
            </div>
            
            {!currentUser ? (
              <div className="py-20 text-center space-y-6 premium-card rounded-[40px]">
                <p className="text-zinc-600 font-black uppercase tracking-[0.5em] text-xs">Authentication Required</p>
                <button onClick={() => setShowLoginMenu(true)} className="text-white text-[10px] font-black uppercase border-b border-white/20 pb-1">Login to access library</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {userAssets.length > 0 ? userAssets.map(a => (
                  <AssetRow key={a.id} asset={a} onClick={onAssetClick} onDownload={handleDownload} />
                )) : (
                  <div className="py-20 text-center premium-card rounded-[40px] border-dashed border-white/10">
                    <p className="text-zinc-800 font-black uppercase tracking-widest italic">No assets published by you yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'profile' ? (
        <div className="flex-grow ml-72 h-screen flex flex-col items-center relative px-20 pt-32 overflow-y-auto custom-scrollbar">
          <div className="glow-accent" />
          {!targetUser ? (
             <div className="text-center space-y-8 animate-pulse mt-20">
                <h1 className="text-6xl font-black uppercase tracking-tighter italic text-white">Identity Missing</h1>
                <p className="text-zinc-600 font-bold uppercase tracking-[0.5em] text-xs">Please login or select a user</p>
                <button 
                  onClick={() => setShowLoginMenu(true)}
                  className="bg-white text-black px-12 py-5 rounded-3xl font-black uppercase text-sm tracking-widest hover:scale-105 transition-all shadow-2xl"
                >
                  INITIALIZE LOGIN
                </button>
             </div>
          ) : (
            <div className="max-w-4xl w-full space-y-12 pb-24">
              <div className="premium-card rounded-[48px] p-12 flex flex-col md:flex-row items-center gap-10 text-center md:text-left z-10 relative">
                 <img src={targetUser.avatar} className="w-40 h-40 rounded-full border-4 border-white/5 shadow-2xl shrink-0 object-cover" alt="avatar" />
                 <div className="flex-grow space-y-4 min-w-0">
                   <div>
                     <h2 className="text-5xl font-black uppercase tracking-tighter italic text-white leading-none truncate">{targetUser.name}</h2>
                     <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px] mt-2">@{targetUser.username}</p>
                   </div>
                   <p className="text-zinc-400 text-sm max-w-xl leading-relaxed whitespace-pre-line">{targetUser.bio || "This user hasn't set a bio yet."}</p>
                   <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                     {targetUser.links?.map((link, idx) => (
                       <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white">
                         {link.label}
                       </a>
                     ))}
                   </div>
                 </div>
                 <div className="shrink-0 flex flex-col gap-3">
                    <div className="px-8 py-6 bg-white/5 rounded-3xl text-center min-w-[140px]">
                       <p className="text-3xl font-black text-white">{targetUser.followers.length}</p>
                       <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mt-1">Followers</p>
                    </div>
                    {currentUser && currentUser.id !== targetUser.id && (
                      <button 
                        onClick={() => handleFollow(targetUser.id)}
                        className={`w-full font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest transition-all ${
                          currentUser.following.includes(targetUser.id)
                            ? 'bg-zinc-800 text-white border border-white/10 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500'
                            : 'bg-white text-black hover:brightness-110 active:scale-95'
                        }`}
                      >
                        {currentUser.following.includes(targetUser.id) ? 'UNFOLLOW' : 'FOLLOW'}
                      </button>
                    )}
                 </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Creations</h3>
                  <div className="h-[1px] flex-grow bg-white/5"></div>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  {targetAssets.length > 0 ? targetAssets.map(a => (
                    <AssetRow key={a.id} asset={a} onClick={onAssetClick} onDownload={handleDownload} onAuthorClick={onAuthorClick} />
                  )) : (
                    <div className="py-20 text-center premium-card rounded-[40px] border-dashed border-white/10">
                      <p className="text-zinc-800 font-black uppercase tracking-widest italic">No public assets found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar px-20 pt-32 pb-24">
          <h1 className="text-6xl font-black uppercase tracking-tighter mb-12 italic text-white">History</h1>
          <div className="grid grid-cols-1 gap-5">
            {historyAssets.length > 0 ? historyAssets.map(a => (
              <AssetRow key={a.id} asset={a} onClick={onAssetClick} onDownload={handleDownload} onAuthorClick={onAuthorClick} />
            )) : <p className="text-zinc-800 font-black uppercase tracking-widest text-center py-20 italic">Your browsing history is empty.</p>}
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="flex-grow ml-72 h-screen px-20 pt-32 pb-24 overflow-y-auto custom-scrollbar">
          <h1 className="text-6xl font-black uppercase tracking-tighter mb-16 italic text-white">Settings</h1>
          <div className="max-w-2xl space-y-12">
            
            {currentUser && (
              <section className="space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Edit Profile</h4>
                <div className="premium-card p-8 rounded-[32px] space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-zinc-600">Biography</label>
                    <textarea 
                      className="w-full bg-[#111] border border-white/5 rounded-2xl p-4 text-white text-sm focus:outline-none min-h-[100px] resize-none"
                      placeholder="Tell the world about yourself..."
                      defaultValue={currentUser.bio}
                      onBlur={(e) => handleUpdateProfile(e.target.value, currentUser.links?.[0]?.label || '', currentUser.links?.[0]?.url || '', currentUser.links?.[1]?.label || '', currentUser.links?.[1]?.url || '')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600">Link 1 Label</label>
                      <input 
                        type="text" className="w-full bg-[#111] border border-white/5 rounded-xl p-3 text-xs text-white" 
                        placeholder="e.g. Twitter"
                        defaultValue={currentUser.links?.[0]?.label}
                        onBlur={(e) => handleUpdateProfile(currentUser.bio || '', e.target.value, currentUser.links?.[0]?.url || '', currentUser.links?.[1]?.label || '', currentUser.links?.[1]?.url || '')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600">Link 1 URL</label>
                      <input 
                        type="url" className="w-full bg-[#111] border border-white/5 rounded-xl p-3 text-xs text-white" 
                        placeholder="https://..."
                        defaultValue={currentUser.links?.[0]?.url}
                        onBlur={(e) => handleUpdateProfile(currentUser.bio || '', currentUser.links?.[0]?.label || '', e.target.value, currentUser.links?.[1]?.label || '', currentUser.links?.[1]?.url || '')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600">Link 2 Label</label>
                      <input 
                        type="text" className="w-full bg-[#111] border border-white/5 rounded-xl p-3 text-xs text-white" 
                        placeholder="e.g. YouTube"
                        defaultValue={currentUser.links?.[1]?.label}
                        onBlur={(e) => handleUpdateProfile(currentUser.bio || '', currentUser.links?.[0]?.label || '', currentUser.links?.[0]?.url || '', e.target.value, currentUser.links?.[1]?.url || '')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-600">Link 2 URL</label>
                      <input 
                        type="url" className="w-full bg-[#111] border border-white/5 rounded-xl p-3 text-xs text-white" 
                        placeholder="https://..."
                        defaultValue={currentUser.links?.[1]?.url}
                        onBlur={(e) => handleUpdateProfile(currentUser.bio || '', currentUser.links?.[0]?.label || '', currentUser.links?.[0]?.url || '', currentUser.links?.[1]?.label || '', e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-zinc-700 uppercase italic">Changes save automatically when you click away</p>
                </div>
              </section>
            )}

            <section className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Visual Appearance</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'default', label: 'Dark Excalibur', desc: 'The classic experience' },
                  { id: 'light', label: 'Cloud Nine', desc: 'Minimalist light mode' },
                  { id: 'cyberpunk', label: 'Neon Protocol', desc: 'High contrast neon' },
                  { id: 'midnight', label: 'Midnight Blue', desc: 'Deep cosmic slate' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`p-6 rounded-[32px] text-left transition-all ${theme === t.id ? 'bg-white text-black shadow-2xl scale-105' : 'premium-card hover:border-white/20'}`}
                  >
                    <p className="font-black uppercase tracking-tighter italic text-lg">{t.label}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${theme === t.id ? 'text-zinc-500' : 'text-zinc-600'}`}>{t.desc}</p>
                  </button>
                ))}
              </div>
            </section>
            
            <section className="pt-12 border-t border-white/5 space-y-6">
               <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 px-4">Account Safety</h4>
               {currentUser ? (
                  <div className="p-8 premium-card rounded-[32px] flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-white">@{currentUser.username}</p>
                      <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mt-1">Logged in</p>
                    </div>
                    <button onClick={handleLogout} className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all">Sign Out</button>
                  </div>
               ) : (
                  <p className="px-4 text-zinc-700 font-black uppercase tracking-widest text-[10px]">No account synchronized.</p>
               )}
            </section>
          </div>
        </div>
      ) : (
        <div className="flex-grow ml-72 flex items-center justify-center">
          <p className="text-zinc-800 font-black uppercase tracking-[1em] italic">Developing Module...</p>
        </div>
      )}

      {currentSelectedAsset && (
        <AssetDetailModal 
          asset={currentSelectedAsset} 
          onClose={() => setSelectedAssetId(null)}
          currentUser={currentUser}
          onLike={(id) => {}} // Placeholder
          onDownload={handleDownload}
          onAuthorClick={onAuthorClick}
          onReport={handleReport}
        />
      )}

      {showLoginMenu && (
        <LoginMenu 
          onClose={() => setShowLoginMenu(false)} 
        />
      )}
      {showPublishModal && <PublishModal onPublish={handlePublish} onClose={() => setShowPublishModal(false)} />}
    </div>
  );
}
