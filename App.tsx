
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, Category, User, Comment } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- Utilitários de Auth ---

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

const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const DISCORD_CLIENT_ID = "911667183334084608";
const REDIRECT_URI = window.location.origin;

// --- Componentes ---

const Navbar: React.FC<{
  user: User | null;
  onLogin: (provider: 'google' | 'discord') => void;
  onLogout: () => void;
  onOpenUpload: () => void;
}> = ({ user, onLogin, onLogout, onOpenUpload }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] glass-header px-8 py-5 flex items-center justify-between">
      <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
          </svg>
        </div>
        <span className="text-sm font-black tracking-tighter uppercase">BloxMarket</span>
      </div>

      <div className="hidden lg:flex items-center gap-10">
        <button onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })} className="text-[13px] font-medium text-muted hover:text-white transition-colors">Marketplace</button>
        <a href="#" className="text-[13px] font-medium text-muted hover:text-white transition-colors">Creators</a>
      </div>

      <div className="flex items-center gap-6">
        {user ? (
          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenUpload}
              className="text-[13px] font-semibold text-white bg-white/5 px-4 py-2 rounded border border-white/10 hover:bg-white/10 transition-all"
            >
              Publish
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <img src={user.avatar} className="w-8 h-8 rounded-full border border-white/20" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-white line-clamp-1 max-w-[80px]">@{user.username}</span>
                <button onClick={onLogout} className="text-[9px] text-muted hover:text-white underline uppercase font-bold tracking-widest text-left">Exit</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
             <button 
                onClick={() => onLogin('google')} 
                className="text-[11px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 rounded hover:bg-white/10 transition-all"
             >
                Google
             </button>
             <button 
                onClick={() => onLogin('discord')} 
                className="text-[11px] font-black uppercase tracking-widest bg-[#5865F2] px-4 py-2 rounded hover:bg-[#4752C4] transition-all"
             >
                Discord
             </button>
             <div className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-muted ml-2">V1.5-FIX</div>
          </div>
        )}
      </div>
    </nav>
  );
};

const Hero = ({ onSearch }: { onSearch: (q: string) => void }) => (
  <section className="relative pt-48 pb-32 flex flex-col items-center text-center px-4 overflow-hidden">
    <div className="mb-8 flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
      <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400 uppercase">Unified Developer Ecosystem</span>
    </div>

    <h1 className="hero-text text-[60px] md:text-[110px] font-black uppercase text-white mb-4">
      YOUR ASSETS,<br />
      <span className="text-[#222222]">LIMITLESS.</span>
    </h1>
    
    <div className="max-w-xl w-full mt-12 relative group">
      <div className="absolute inset-y-0 left-6 flex items-center text-muted group-focus-within:text-white transition-colors">
        <Icons.Search />
      </div>
      <input
        type="text"
        placeholder="Find .rbxm, .rbxl, or .rbxmx assets..."
        className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl py-6 pl-16 pr-6 text-white focus:outline-none focus:border-white/30 transition-all text-lg font-medium"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  </section>
);

const AssetCard: React.FC<{
  asset: Asset;
  onClick: (asset: Asset) => void;
}> = ({ asset, onClick }) => {
  return (
    <div
      onClick={() => onClick(asset)}
      className="group flex flex-col cursor-pointer transition-all duration-500"
    >
      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/5 group-hover:border-white/20 transition-all relative">
        <img
          src={asset.thumbnailUrl}
          alt={asset.title}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
        />
        <div className="absolute top-2 right-2">
           <span className={`text-[9px] font-black px-2 py-0.5 rounded border bg-white/5 border-white/10 uppercase ${asset.fileType === '.rbxmx' ? 'text-purple-400 border-purple-400/30' : 'text-muted'}`}>
            {asset.fileType}
           </span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <h3 className="text-sm font-bold text-white uppercase tracking-tight line-clamp-1">{asset.title}</h3>
        <div className="flex items-center gap-2">
          <img src={asset.authorAvatar} className="w-4 h-4 rounded-full grayscale group-hover:grayscale-0 transition-all" />
          <span className="text-[11px] font-medium text-muted">@{asset.authorName}</span>
          <span className="text-[11px] text-white/20">•</span>
          <span className="text-[11px] font-medium text-muted uppercase tracking-tighter">{asset.category}</span>
        </div>
      </div>
    </div>
  );
};

const AssetModal: React.FC<{
  asset: Asset;
  onClose: () => void;
  currentUser: User | null;
  onDownload: (asset: Asset) => void;
  onLike: (assetId: string) => void;
  onComment: (assetId: string, text: string) => void;
}> = ({ asset, onClose, currentUser, onDownload, onLike, onComment }) => {
  const [commentText, setCommentText] = useState('');
  const isLiked = currentUser && asset.likes.includes(currentUser.id);

  const getYoutubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const videoEmbedUrl = getYoutubeEmbedUrl(asset.videoUrl);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-[#050505] border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="rounded-xl overflow-hidden mb-8 border border-white/10 aspect-video bg-black relative">
            {videoEmbedUrl ? (
              <iframe
                className="w-full h-full"
                src={videoEmbedUrl}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <img src={asset.thumbnailUrl} className="w-full h-full object-contain" />
            )}
          </div>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-black uppercase text-white tracking-tighter">{asset.title}</h2>
            <button 
              onClick={() => onLike(asset.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded border transition-all ${isLiked ? 'bg-white text-black border-white' : 'bg-white/5 text-white border-white/10 hover:border-white/30'}`}
            >
              <Icons.Like filled={!!isLiked} />
              <span className="text-xs font-bold">{asset.likes.length}</span>
            </button>
          </div>
          <p className="text-muted text-sm leading-relaxed mb-8">{asset.description}</p>
          
          <div className="border-t border-white/5 pt-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-6">Comments</h4>
            <div className="space-y-6">
              {asset.comments.map(c => (
                <div key={c.id} className="flex gap-4">
                  <img src={c.userAvatar} className="w-8 h-8 rounded-full border border-white/10 grayscale" />
                  <div>
                    <p className="text-[11px] font-bold text-white mb-1">@{c.userName}</p>
                    <p className="text-xs text-muted">{c.text}</p>
                  </div>
                </div>
              ))}
              {currentUser && (
                <div className="flex gap-4 mt-8">
                  <img src={currentUser.avatar} className="w-8 h-8 rounded-full" />
                  <div className="flex-grow">
                    <textarea 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-white/30"
                    />
                    <button 
                      onClick={() => { if(commentText) { onComment(asset.id, commentText); setCommentText(''); }}}
                      className="mt-2 text-[10px] font-black uppercase bg-white/5 border border-white/10 px-4 py-2 rounded"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 bg-[#0a0a0a] border-l border-white/10 p-8 flex flex-col">
          <button onClick={onClose} className="self-end text-muted hover:text-white mb-12">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex-grow space-y-6">
            <div>
              <p className="text-[9px] text-muted font-black uppercase mb-1 tracking-widest">Type</p>
              <p className="text-xs text-white font-bold">{asset.fileType}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted font-black uppercase mb-1 tracking-widest">Category</p>
              <p className="text-xs text-white font-bold">{asset.category}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted font-black uppercase mb-1 tracking-widest">Downloads</p>
              <p className="text-xs text-white font-bold">{asset.downloadCount}</p>
            </div>
          </div>

          <button
            onClick={() => onDownload(asset)}
            className="w-full bg-white text-black font-black uppercase py-4 rounded hover:bg-white/90 transition-all text-[11px] tracking-widest"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

const PublishModal: React.FC<{
  onClose: () => void;
  onPublish: (asset: Partial<Asset>, file: File) => void;
  user: User;
}> = ({ onClose, onPublish, user }) => {
  const [formData, setFormData] = useState<Partial<Asset>>({
    title: '',
    description: '',
    category: Category.MODEL,
    fileType: '.rbxm',
    creditsRequired: false,
    thumbnailUrl: '',
    videoUrl: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !selectedFile) return alert('Title and File are required!');
    onPublish(formData, selectedFile);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-2xl bg-[#050505] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
        <h2 className="text-2xl font-black uppercase text-white mb-8 tracking-widest">Publish Asset</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase text-muted mb-2">Title</label>
            <input 
              type="text" 
              required
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-white/30"
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted mb-2">Category</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm text-white"
                onChange={(e) => setFormData({...formData, category: e.target.value as Category})}
              >
                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted mb-2">Format</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm text-white"
                onChange={(e) => setFormData({...formData, fileType: e.target.value as any})}
              >
                <option value=".rbxm">.rbxm</option>
                <option value=".rbxl">.rbxl</option>
                <option value=".rbxmx">.rbxmx</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted mb-2">Thumbnail URL</label>
              <input 
                type="text" 
                placeholder="https://imgur.com/..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm"
                onChange={(e) => setFormData({...formData, thumbnailUrl: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted mb-2">Video URL (Optional)</label>
              <input 
                type="text" 
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm"
                onChange={(e) => setFormData({...formData, videoUrl: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-muted mb-2">Roblox File (.rbxm, .rbxl, .rbxmx)</label>
            <div className="relative group">
              <input 
                type="file" 
                required
                accept=".rbxm,.rbxl,.rbxmx"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <div className="w-full bg-[#0a0a0a] border border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center transition-all group-hover:border-white/30">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  {selectedFile ? selectedFile.name : 'Select or drag file'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-muted mb-2">Description</label>
            <textarea 
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-sm h-24"
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 text-[11px] font-black uppercase text-muted">Cancel</button>
          <button type="submit" className="flex-1 bg-white text-black font-black uppercase py-4 rounded text-[11px]">Distribute</button>
        </div>
      </form>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('blox_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<'Discover' | 'Models' | 'Plugins'>('Discover');

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get('access_token');
      if (token) fetchDiscordUser(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchDiscordUser = async (token: string) => {
    try {
      const resp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      saveUser({
        id: data.id,
        name: data.global_name || data.username,
        username: data.username,
        avatar: `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`,
        provider: 'discord',
        followers: [],
        following: []
      });
    } catch (e) { console.error(e); }
  };

  const handleLogin = (provider: 'google' | 'discord') => {
    if (provider === 'google') {
      (window as any).google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          const payload = parseJwt(response.credential);
          if (payload) {
            saveUser({
              id: payload.sub,
              name: payload.name,
              username: payload.email.split('@')[0],
              avatar: payload.picture,
              provider: 'google',
              followers: [],
              following: []
            });
          }
        },
        itp_support: true, // Improved compatibility for ITP browsers
        use_fedcm_for_prompt: false // Opt-out of FedCM to avoid NotAllowedError in sandboxes
      });
      (window as any).google?.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google One Tap prompt skipped or blocked');
        }
      });
    } else {
      const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
      window.location.href = discordUrl;
    }
  };

  const saveUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('blox_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('blox_user');
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        const kws = await getSearchKeywords(searchQuery);
        setKeywords(kws);
        setIsSearching(false);
      } else {
        setKeywords([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (currentTab === 'Models' && asset.fileType !== '.rbxm') return false;
      if (currentTab === 'Plugins' && asset.fileType !== '.rbxmx') return false;
      if (searchQuery === '') return true;
      const lowerQuery = searchQuery.toLowerCase();
      return asset.title.toLowerCase().includes(lowerQuery) || keywords.some(kw => asset.title.toLowerCase().includes(kw.toLowerCase()));
    });
  }, [assets, searchQuery, keywords, currentTab]);

  const handleDownload = (asset: Asset) => {
    if (!currentUser) return handleLogin('google');
    const blob = new Blob([`Roblox Content: ${asset.title}`], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.title}${asset.fileType}`;
    a.click();
    setAssets(prev => prev.map(a => a.id === asset.id ? {...a, downloadCount: a.downloadCount + 1} : a));
  };

  const handleLike = (id: string) => {
    if (!currentUser) return;
    setAssets(prev => prev.map(a => a.id === id ? {
      ...a, 
      likes: a.likes.includes(currentUser.id) ? a.likes.filter(uid => uid !== currentUser.id) : [...a.likes, currentUser.id]
    } : a));
  };

  const handleComment = (id: string, text: string) => {
    if (!currentUser) return;
    const comment: Comment = {
      id: Math.random().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text,
      timestamp: Date.now()
    };
    setAssets(prev => prev.map(a => a.id === id ? {...a, comments: [...a.comments, comment]} : a));
  };

  const handlePublish = (data: Partial<Asset>, file: File) => {
    if (!currentUser) return;
    const newAsset: Asset = {
      id: Math.random().toString(),
      userId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      title: data.title!,
      description: data.description || '',
      category: data.category!,
      thumbnailUrl: data.thumbnailUrl || 'https://picsum.photos/seed/rbx/800/450',
      videoUrl: data.videoUrl,
      fileType: data.fileType as any,
      creditsRequired: !!data.creditsRequired,
      likes: [],
      dislikes: [],
      comments: [],
      downloadCount: 0,
      timestamp: Date.now()
    };
    setAssets([newAsset, ...assets]);
    setIsPublishing(false);
  };

  const currentSelectedAsset = useMemo(() => {
    return assets.find(a => a.id === selectedAsset?.id) || null;
  }, [assets, selectedAsset]);

  return (
    <div className="min-h-screen">
      <Navbar
        user={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenUpload={() => setIsPublishing(true)}
      />

      <Hero onSearch={setSearchQuery} />

      <main className="max-w-7xl mx-auto px-8 pb-32">
        <div className="flex items-center justify-between mb-12 pb-6 border-b border-white/5">
          <div className="flex gap-8">
            {(['Discover', 'Models', 'Plugins'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all ${currentTab === tab ? 'text-white' : 'text-muted hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onClick={setSelectedAsset} />
            ))}
          </div>
        ) : (
          <div className="py-40 text-center opacity-20 uppercase font-black tracking-widest text-2xl">No items found</div>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 bg-[#0a0a0a] text-center">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[0.4em]">BloxMarket © 2025 • High-Performance Roblox Distribution</p>
      </footer>

      {isSearching && (
        <div className="fixed bottom-12 right-12 bg-white text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[2000]">
          <div className="w-2 h-2 bg-black rounded-full animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-widest">Neural Filtering</span>
        </div>
      )}

      {currentSelectedAsset && (
        <AssetModal 
          asset={currentSelectedAsset} 
          onClose={() => setSelectedAsset(null)} 
          currentUser={currentUser}
          onDownload={handleDownload}
          onLike={handleLike}
          onComment={handleComment}
        />
      )}

      {isPublishing && currentUser && (
        <PublishModal 
          user={currentUser} 
          onClose={() => setIsPublishing(false)} 
          onPublish={handlePublish} 
        />
      )}
    </div>
  );
}
