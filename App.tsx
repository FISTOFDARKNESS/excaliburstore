
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, User, Comment, Category } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const RAPID_API_KEY = "8ed62ca7c5msh2f6b793b33c887dp1a5499jsnf136d5071315";
const RAPID_API_HOST = "upload.p.rapidapi.com";
const UPLOADCARE_PUB_KEY = "demopublickey";

// --- Helpers ---
const uploadToCloud = async (file: File): Promise<string> => {
  const data = new FormData();
  data.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUB_KEY);
  data.append('file', file);
  data.append('UPLOADCARE_STORE', '1');

  const response = await fetch('https://upload.p.rapidapi.com/base/', {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': RAPID_API_HOST,
      // Note: We don't set Content-Type here because FormData handles it with boundaries
    },
    body: data
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (result.file) {
    // Returns the direct CDN URL from Uploadcare
    return `https://ucarecdn.com/${result.file}/`;
  }
  throw new Error("Cloud storage did not return a file identifier.");
};

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) { return null; }
};

// --- Components ---

const LoginMenu = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.renderButton(
        document.getElementById("google-login-btn-container"),
        { theme: "filled_blue", size: "large", width: "320", shape: "pill", text: "continue_with" }
      );
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 space-y-8 shadow-2xl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-black" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </div>
          <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white">Identity Hub</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Access the BloxMarket network</p>
        </div>
        <div id="google-login-btn-container" className="flex justify-center transition-transform hover:scale-[1.02]" />
        <button onClick={onClose} className="w-full text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] hover:text-white transition-colors py-2">Back to Market</button>
      </div>
    </div>
  );
};

// Fix: Define AssetRowProps interface and use React.FC to allow 'key' prop in list mapping.
interface AssetRowProps {
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-[32px] p-6 flex items-center gap-8 cursor-pointer group w-full hover:border-white/20 hover:bg-white/[0.03]">
    <div className="w-28 h-28 rounded-[28px] overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={asset.title} />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-all" />
      {asset.creditsRequired && (
        <div className="absolute top-3 right-3 bg-yellow-400 text-black text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest">Credits</div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-black text-2xl text-white truncate group-hover:text-blue-400 transition-colors tracking-tighter italic">{asset.title}</h3>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-colors">
          {asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-[0.2em]">{asset.category}</span>
        {asset.reports && asset.reports.length > 0 && (
          <span className="bg-red-500/10 text-red-500 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{asset.reports.length} Reports</span>
        )}
      </div>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-4 text-zinc-700">
         <span className="text-[10px] font-black">{asset.downloadCount}</span>
         <Icons.Download />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white text-black px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl">
        GET FILE
      </button>
    </div>
  </div>
);

const PublishModal = ({ onClose, onPublish, isUploading }: { onClose: () => void, onPublish: (files: { thumb: File, rbx: File, data: any }) => void, isUploading: boolean }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState(Category.MODEL);
  const [thumb, setThumb] = useState<File | null>(null);
  const [rbxFile, setRbxFile] = useState<File | null>(null);
  const [credits, setCredits] = useState(false);

  const handleRbxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (['.rbxm', '.rbxl', '.rbxmx'].includes(ext)) {
        setRbxFile(file);
      } else {
        alert("Incorrect file format! Please use .rbxm, .rbxl, or .rbxmx.");
        e.target.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumb || !rbxFile) return alert("Thumbnail and Roblox file are mandatory!");
    onPublish({ thumb, rbx: rbxFile, data: { title, desc, category, credits } });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[48px] p-12 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {isUploading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-8 text-center">
            <div className="relative">
              <div className="w-20 h-20 border-2 border-white/5 border-t-white rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-white/10 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">Uploading to Cloud</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Propagating file to the global hub</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-black uppercase tracking-tighter italic text-white">Publish Asset</h2>
              <button onClick={onClose} className="p-3 text-zinc-600 hover:text-white transition-all bg-white/5 rounded-full"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Title</label>
                <input required type="text" placeholder="Advanced Combat System" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-white/30 transition-all font-bold" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Roblox File (.rbxm, .rbxl, .rbxmx) *</label>
                <label className={`group w-full p-8 rounded-[32px] border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={handleRbxChange} className="hidden" />
                  <Icons.Script />
                  <span className="font-black text-xs uppercase tracking-[0.2em] mt-3">{rbxFile ? `READY: ${rbxFile.name}` : "SELECT ROBLOX FILE"}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Thumbnail *</label>
                  <label className={`w-full h-40 rounded-[32px] border border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Category</label>
                  <select className="w-full h-40 bg-white/5 border border-white/10 rounded-[32px] p-6 text-white appearance-none text-center font-black uppercase tracking-widest cursor-pointer hover:bg-white/[0.07] transition-all" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Brief Description</label>
                <textarea required className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white min-h-[120px] resize-none focus:outline-none focus:border-white/30 transition-all text-sm" placeholder="Explain the key features..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>

              <button type="submit" className="w-full bg-white text-black font-black uppercase py-7 rounded-[32px] text-xs tracking-[0.4em] hover:scale-[1.01] active:scale-95 transition-all shadow-2xl">INITIATE PUBLICATION</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('bx_users_v5') || JSON.stringify(MOCK_USERS)));
  const [currentUser, setCurrentUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('bx_cur_user_v5') || 'null'));
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('bx_assets_v5');
    return saved ? JSON.parse(saved) : MOCK_ASSETS.map(a => ({ ...a, reports: a.reports || [] }));
  });

  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('bx_theme_v5') || 'default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

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
    localStorage.setItem('bx_users_v5', JSON.stringify(users));
    localStorage.setItem('bx_cur_user_v5', JSON.stringify(currentUser));
    localStorage.setItem('bx_assets_v5', JSON.stringify(assets));
    localStorage.setItem('bx_theme_v5', theme);
    document.body.className = `theme-${theme}`;
  }, [users, currentUser, assets, theme]);

  const handleGoogleSignIn = (response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: User = { id: payload.sub, name: payload.name, username: payload.email.split('@')[0], avatar: payload.picture, provider: 'google', followers: [], following: [], bio: "Verified Creator", links: [] };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
    }
    setShowLoginMenu(false);
  };

  const handlePublish = async (files: { thumb: File, rbx: File, data: any }) => {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      const thumbUrl = await uploadToCloud(files.thumb);
      const rbxUrl = await uploadToCloud(files.rbx);
      
      const newAsset: Asset = {
        id: 'a_' + Date.now(),
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: files.data.title,
        description: files.data.desc,
        category: files.data.category,
        thumbnailUrl: thumbUrl,
        fileData: rbxUrl,
        fileType: files.rbx.name.substring(files.rbx.name.lastIndexOf('.')) as any,
        creditsRequired: files.data.credits,
        likes: [],
        dislikes: [],
        reports: [],
        comments: [],
        downloadCount: 0,
        timestamp: Date.now()
      };

      setAssets(prev => [newAsset, ...prev]);
      setShowPublishModal(false);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReport = (id: string) => {
    if (!currentUser) return setShowLoginMenu(true);
    setAssets(prev => prev.map(a => a.id === id ? { ...a, reports: Array.from(new Set([...(a.reports || []), currentUser.id])) } : a));
    alert("This asset has been flagged for moderation.");
  };

  const handleDownload = (asset: Asset) => {
    if (!currentUser) return setShowLoginMenu(true);
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a));
    const link = document.createElement('a');
    link.href = asset.fileData || '';
    link.setAttribute('target', '_blank');
    link.setAttribute('download', `${asset.title.replace(/\s+/g, '_')}${asset.fileType}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAssets = useMemo(() => assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())), [assets, searchQuery]);
  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[var(--bg-color)] min-h-screen text-[var(--text-color)]">
      <aside className="w-80 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-10 z-50 bg-[#050505] shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-2xl italic text-white">EXCALIBUR</span>
        </div>
        <nav className="flex-grow space-y-4">
          {['home', 'library', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-5 px-6 py-4 text-[12px] font-black tracking-[0.2em] uppercase transition-all duration-300 ${activeTab === tab ? 'sidebar-link-active' : 'text-zinc-600 hover:text-white'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'library' ? <Icons.Script /> : <Icons.Plus />}
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-10 border-t border-white/5">
          {currentUser ? (
            <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-4">
              <div className="flex items-center gap-4">
                <img src={currentUser.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                <span className="text-[11px] font-black uppercase truncate text-white">{currentUser.username}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); setActiveTab('home'); }} className="w-full text-[10px] font-black uppercase text-zinc-600 hover:text-red-500 transition-colors py-2 border border-transparent hover:border-red-500/20 rounded-xl">Sign Out</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-5 rounded-[24px] text-[11px] tracking-[0.3em] hover:scale-[1.02] transition-all shadow-2xl">SYNCHRONIZE</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-80 min-h-screen">
        {activeTab === 'home' && (
          <div className="px-24 pt-40 pb-32 relative overflow-y-auto h-screen custom-scrollbar">
            <div className="glow-accent" />
            <div className="max-w-5xl mx-auto text-center">
              <h1 className="text-[140px] font-black uppercase leading-[0.7] tracking-tighter text-white animate-in slide-in-from-bottom duration-700">Explore</h1>
              <h1 className="text-[140px] font-black uppercase leading-[0.7] tracking-tighter text-ghost mb-24 animate-in slide-in-from-bottom duration-1000">The Market</h1>
              <div className="relative group max-w-3xl mx-auto">
                <input type="text" placeholder="Search the cloud hub..." className="w-full search-pill rounded-full py-10 px-16 text-3xl font-bold text-center mb-32 focus:outline-none placeholder:text-zinc-800 focus:border-white/10 transition-all" onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="space-y-6 text-left animate-in fade-in duration-1000 delay-300">
                {filteredAssets.length > 0 ? filteredAssets.map(a => (
                  <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />
                )) : (
                  <div className="py-32 text-center opacity-20 font-black uppercase tracking-[1em]">Void...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="px-24 pt-40 pb-32 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-end mb-24">
                <div className="space-y-4">
                  <h1 className="text-8xl font-black uppercase italic text-white tracking-tighter leading-none">Vault</h1>
                  <p className="text-zinc-600 text-xs font-black uppercase tracking-[0.5em] ml-2">Personal cloud encrypted storage</p>
                </div>
                {currentUser && (
                  <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-12 py-5 rounded-[28px] font-black uppercase text-[12px] tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3">
                    <Icons.Plus />
                    NEW PUBLICATION
                  </button>
                )}
              </div>
              {!currentUser ? (
                <div className="p-32 premium-card rounded-[64px] text-center border-dashed">
                  <p className="text-zinc-600 font-black uppercase tracking-[0.5em] text-xs">Identity verification required</p>
                  <button onClick={() => setShowLoginMenu(true)} className="mt-8 bg-white/5 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">Sign In</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {assets.filter(a => a.userId === currentUser.id).length > 0 ? assets.filter(a => a.userId === currentUser.id).map(a => (
                    <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />
                  )) : (
                    <div className="py-32 text-center premium-card rounded-[48px] border-dashed border-white/5">
                      <p className="text-zinc-800 font-black uppercase tracking-widest italic">No files synchronized to your vault yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-24 pt-40 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-16 pb-32">
              <div className="premium-card rounded-[64px] p-16 flex flex-col lg:flex-row items-center gap-16 relative overflow-hidden">
                <div className="glow-accent" />
                <img src={targetUser.avatar} className="w-56 h-56 rounded-full border-8 border-white/5 relative z-10 shadow-2xl object-cover" />
                <div className="flex-grow z-10 text-center lg:text-left space-y-6">
                  <div>
                    <h2 className="text-7xl font-black uppercase italic text-white tracking-tighter leading-none">@{targetUser.username}</h2>
                    <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[10px] mt-4 ml-1">Universal Identity Registered</p>
                  </div>
                  <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl font-medium">{targetUser.bio || "This user prefers to let their creations speak for themselves."}</p>
                </div>
              </div>
              <div className="space-y-10">
                <div className="flex items-center gap-6">
                  <h3 className="text-3xl font-black uppercase italic text-white tracking-tighter">Manifested Creations</h3>
                  <div className="h-[1px] flex-grow bg-white/5" />
                </div>
                <div className="space-y-6">
                  {assets.filter(a => a.userId === targetUser.id).map(a => (
                    <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId);
            if (!asset) return null;
            return (
              <div className="relative w-full max-w-5xl bg-[#080808] border border-white/10 rounded-[64px] shadow-2xl overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
                <div className="flex-grow p-12 overflow-y-auto custom-scrollbar">
                  <div className="aspect-video w-full rounded-[48px] overflow-hidden border border-white/5 shadow-2xl">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-12 space-y-6">
                    <h2 className="text-5xl font-black uppercase italic text-white tracking-tighter">{asset.title}</h2>
                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-blue-500">
                      <span>{asset.category}</span>
                      <span className="text-zinc-800">•</span>
                      <span>{asset.fileType}</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-lg font-medium whitespace-pre-line">{asset.description}</p>
                  </div>
                </div>
                <div className="w-full lg:w-[380px] bg-[#0a0a0a] border-l border-white/5 p-12 flex flex-col justify-between">
                  <div className="space-y-10">
                    <div className="flex justify-between items-center">
                      <button onClick={() => handleReport(asset.id)} className="text-[10px] font-black uppercase text-zinc-800 hover:text-red-500 transition-colors tracking-[0.3em] flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                        REPORT
                      </button>
                      <button onClick={() => setSelectedAssetId(null)} className="text-zinc-600 hover:text-white transition-all bg-white/5 rounded-full p-2"><Icons.Plus /></button>
                    </div>
                    <div className="space-y-4">
                      <div className="premium-card p-8 rounded-[32px] text-center group">
                        <p className="text-4xl font-black text-white group-hover:text-blue-400 transition-colors">{asset.downloadCount}</p>
                        <p className="text-[10px] font-black uppercase text-zinc-700 tracking-[0.4em] mt-2">Global Fetches</p>
                      </div>
                      <div className="premium-card p-8 rounded-[32px] flex items-center gap-5 hover:border-white/10 transition-all cursor-pointer" onClick={() => { setViewingUserId(asset.userId); setActiveTab('profile'); setSelectedAssetId(null); }}>
                        <img src={asset.authorAvatar} className="w-12 h-12 rounded-full border border-white/5" />
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-white truncate">@{asset.authorName}</p>
                          <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1">Creator</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-7 rounded-[32px] text-sm tracking-[0.5em] hover:brightness-110 active:scale-95 transition-all shadow-2xl mt-12">GET FILE</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showLoginMenu && <LoginMenu onClose={() => setShowLoginMenu(false)} />}
      {showPublishModal && <PublishModal isUploading={isUploading} onPublish={handlePublish} onClose={() => setShowPublishModal(false)} />}
    </div>
  );
}
