
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, User, Comment, Category } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';

// --- CONFIGURAÇÃO ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const RAPID_API_KEY = "8ed62ca7c5msh2f6b793b33c887dp1a5499jsnf136d5071315";
const RAPID_API_HOST = "upload.p.rapidapi.com";
const UPLOADCARE_PUB_KEY = "demopublickey";

// --- Helpers ---
const getEmbedUrl = (url: string) => {
  if (!url) return null;
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(ytRegex);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return null;
};

const uploadToCloud = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUB_KEY);
    data.append('file', file);
    data.append('UPLOADCARE_STORE', '1');

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener('readystatechange', function () {
      if (this.readyState === this.DONE) {
        try {
          const response = JSON.parse(this.responseText);
          if (response.file) {
            // Retorna a URL do CDN da Uploadcare
            resolve(`https://ucarecdn.com/${response.file}/`);
          } else {
            reject("Upload failed: No file ID returned");
          }
        } catch (e) {
          reject("Upload failed: Invalid response");
        }
      }
    });

    xhr.open('POST', 'https://upload.p.rapidapi.com/base/');
    xhr.setRequestHeader('x-rapidapi-key', RAPID_API_KEY);
    xhr.setRequestHeader('x-rapidapi-host', RAPID_API_HOST);
    xhr.send(data);
  });
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-white rounded-xl mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-black" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">BloxMarket Login</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Connect with Google</p>
        </div>
        <div id="google-login-btn-container" className="flex justify-center" />
        <button onClick={onClose} className="w-full text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] hover:text-white transition-colors">Cancel</button>
      </div>
    </div>
  );
};

const AssetRow = ({ asset, onClick, onDownload, onAuthorClick }: { asset: Asset, onClick: (a: Asset) => void, onDownload: (a: Asset) => void, onAuthorClick?: (uid: string) => void }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-[32px] p-5 flex items-center gap-6 cursor-pointer group w-full">
    <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={asset.title} />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
      {asset.creditsRequired && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-1 rounded-md uppercase">Credits Required</div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-xl text-white truncate group-hover:text-blue-400 transition-colors tracking-tight">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-1">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-colors">
          {asset.authorName}
        </button>
        <span className="text-zinc-800">•</span>
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-2">
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
        GET FILE
      </button>
      {asset.reports && asset.reports.length > 0 && (
         <span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest">{asset.reports.length} Reports</span>
      )}
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
        alert("Invalid file! Only .rbxm, .rbxl, or .rbxmx.");
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {isUploading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="w-16 h-16 border-4 border-white/5 border-t-white rounded-full animate-spin" />
            <h2 className="text-2xl font-black uppercase italic text-white">Uploading to Cloud...</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Saving your files to the global hub</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white">Publish Content</h2>
              <button onClick={onClose} className="p-2 text-zinc-600 hover:text-white transition-all"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Asset Title</label>
                <input required type="text" placeholder="Ex: Epic Sword System" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Roblox File (.rbxm, .rbxl, .rbxmx) *</label>
                <label className={`w-full p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}>
                  <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={handleRbxChange} className="hidden" />
                  <span className="font-black text-xs uppercase tracking-widest">{rbxFile ? `READY: ${rbxFile.name}` : "SELECT ROBLOX FILE"}</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Thumbnail *</label>
                  <label className={`w-full h-32 rounded-2xl border border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden ${thumb ? 'border-white/40' : 'border-white/10'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Category</label>
                  <select className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none text-center font-bold" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Description</label>
                <textarea required className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white min-h-[100px] resize-none" placeholder="Describe your asset..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-white text-black font-black uppercase py-6 rounded-[24px] text-sm tracking-[0.3em] hover:brightness-110 active:scale-95 transition-all shadow-xl">PUBLISH TO MARKET</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('bx_users_v4') || JSON.stringify(MOCK_USERS)));
  const [currentUser, setCurrentUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('bx_cur_user_v4') || 'null'));
  const [assets, setAssets] = useState<Asset[]>(() => JSON.parse(localStorage.getItem('bx_assets_v4') || JSON.stringify(MOCK_ASSETS)));
  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('bx_theme') || 'default');
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
    localStorage.setItem('bx_users_v4', JSON.stringify(users));
    localStorage.setItem('bx_cur_user_v4', JSON.stringify(currentUser));
    localStorage.setItem('bx_assets_v4', JSON.stringify(assets));
    localStorage.setItem('bx_theme', theme);
    document.body.className = `theme-${theme}`;
  }, [users, currentUser, assets, theme]);

  const handleGoogleSignIn = (response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: User = { id: payload.sub, name: payload.name, username: payload.email.split('@')[0], avatar: payload.picture, provider: 'google', followers: [], following: [], bio: "Professional Roblox Creator", links: [] };
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
    } catch (e) {
      alert("Error publishing: " + e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReport = (id: string) => {
    if (!currentUser) return setShowLoginMenu(true);
    setAssets(prev => prev.map(a => a.id === id ? { ...a, reports: Array.from(new Set([...(a.reports || []), currentUser.id])) } : a));
    alert("Report sent for review.");
  };

  const handleDownload = (asset: Asset) => {
    if (!currentUser) return setShowLoginMenu(true);
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, downloadCount: a.downloadCount + 1 } : a));
    const link = document.createElement('a');
    link.href = asset.fileData || '';
    link.setAttribute('download', `${asset.title.replace(/\s+/g, '_')}${asset.fileType}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAssets = useMemo(() => assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())), [assets, searchQuery]);
  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[var(--bg-color)] min-h-screen text-[var(--text-color)]">
      <aside className="w-72 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-8 z-50 bg-[#050505]">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-xl italic text-white">EXCALIBUR</span>
        </div>
        <nav className="flex-grow space-y-3">
          {['home', 'library', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-4 px-5 py-3 text-[11px] font-black tracking-widest uppercase transition-all ${activeTab === tab ? 'sidebar-link-active' : 'text-zinc-600 hover:text-white'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'library' ? <Icons.Script /> : <Icons.Plus />}
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8 border-t border-white/5">
          {currentUser ? (
            <div className="p-4 bg-white/5 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-full" />
                <span className="text-[10px] font-black uppercase truncate">{currentUser.username}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); setActiveTab('home'); }} className="w-full text-[9px] font-black uppercase text-zinc-600 hover:text-red-500 transition-colors">Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:scale-[1.02] transition-all">Login</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-72 min-h-screen">
        {activeTab === 'home' && (
          <div className="px-20 pt-32 pb-24 relative overflow-y-auto h-screen custom-scrollbar">
            <div className="glow-accent" />
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter text-white">Explore</h1>
              <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter text-ghost mb-16">The Market</h1>
              <input type="text" placeholder="Search Roblox Files..." className="w-full search-pill rounded-full py-8 px-12 text-2xl font-semibold text-center mb-24 focus:outline-none placeholder:text-zinc-800" onChange={e => setSearchQuery(e.target.value)} />
              <div className="space-y-5 text-left">{filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}</div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="px-20 pt-32 pb-24 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-16">
                <div><h1 className="text-6xl font-black uppercase italic text-white">My Library</h1><p className="text-zinc-600 text-xs font-black uppercase tracking-[0.4em] mt-2">Personal cloud vault</p></div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all">Publish New</button>}
              </div>
              {!currentUser ? <div className="p-20 premium-card rounded-[40px] text-center"><p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Login required to view vault</p></div> : <div className="space-y-5">{assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}</div>}
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-20 pt-32 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 pb-24">
              <div className="premium-card rounded-[48px] p-12 flex items-center gap-10 relative overflow-hidden">
                <div className="glow-accent" />
                <img src={targetUser.avatar} className="w-40 h-40 rounded-full border-4 border-white/5 relative z-10" />
                <div className="flex-grow z-10">
                  <h2 className="text-5xl font-black uppercase italic text-white">@{targetUser.username}</h2>
                  <p className="text-zinc-400 mt-4 max-w-md">{targetUser.bio || "Enthusiast creator in BloxMarket."}</p>
                </div>
              </div>
              <div className="space-y-8">
                <h3 className="text-2xl font-black uppercase italic text-white border-b border-white/5 pb-4">Creations</h3>
                <div className="space-y-5">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={handleDownload} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId);
            if (!asset) return null;
            return (
              <div className="relative w-full max-w-4xl bg-[#080808] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                <div className="flex-grow p-10 overflow-y-auto custom-scrollbar">
                  <img src={asset.thumbnailUrl} className="w-full aspect-video object-cover rounded-[32px] border border-white/5" />
                  <div className="mt-8 space-y-4">
                    <h2 className="text-4xl font-black uppercase italic text-white">{asset.title}</h2>
                    <p className="text-zinc-500 leading-relaxed">{asset.description}</p>
                  </div>
                </div>
                <div className="w-full md:w-[320px] bg-[#0a0a0a] border-l border-white/5 p-10 flex flex-col justify-between">
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <button onClick={() => handleReport(asset.id)} className="text-[9px] font-black uppercase text-zinc-700 hover:text-red-500 transition-colors tracking-widest">Report Asset</button>
                      <button onClick={() => setSelectedAssetId(null)} className="text-zinc-600 hover:text-white"><Icons.Plus /></button>
                    </div>
                    <div className="premium-card p-6 rounded-2xl text-center">
                      <p className="text-3xl font-black text-white">{asset.downloadCount}</p>
                      <p className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Downloads</p>
                    </div>
                    <div className="premium-card p-6 rounded-2xl text-center">
                      <p className="text-xl font-black text-blue-500 uppercase">{asset.fileType}</p>
                      <p className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Extension</p>
                    </div>
                  </div>
                  <button onClick={() => handleDownload(asset)} className="w-full bg-white text-black font-black uppercase py-5 rounded-[24px] text-xs tracking-[0.3em] hover:brightness-110 active:scale-95 transition-all">GET FILE</button>
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
