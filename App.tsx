
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, Category, User, Comment } from './types';
import { MOCK_ASSETS, Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- Components ---

const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  user, 
  onLogin, 
  onLogout 
}: { 
  activeTab: string; 
  setActiveTab: (tab: any) => void; 
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}) => (
  <aside className="w-72 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-6 z-50 bg-[#050505]">
    <div className="flex items-center gap-3 px-2 mb-12">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
        </svg>
      </div>
      <span className="font-extrabold uppercase tracking-tighter text-lg">BloxMarket</span>
    </div>

    <nav className="flex-grow space-y-2">
      {[
        { id: 'home', label: 'Home', icon: <Icons.Model /> },
        { id: 'search', label: 'Cloud Search', icon: <Icons.Search /> },
        { id: 'library', label: 'Library', icon: <Icons.Script /> },
        { id: 'settings', label: 'Settings', icon: <Icons.Plus /> }
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-semibold transition-all ${
            activeTab === item.id ? 'sidebar-link-active' : 'text-zinc-500 hover:text-white'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>

    <div className="mt-auto space-y-4">
      {user ? (
        <div className="p-4 premium-card rounded-2xl flex items-center gap-3">
          <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" />
          <div className="flex-grow min-w-0">
            <p className="text-xs font-bold truncate">@{user.username}</p>
            <button onClick={onLogout} className="text-[10px] text-zinc-500 hover:text-white uppercase font-black">Sign Out</button>
          </div>
        </div>
      ) : (
        <button 
          onClick={onLogin}
          className="w-full bg-[#facc15] text-black font-black uppercase py-4 rounded-2xl text-[11px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Premium Login
        </button>
      )}
    </div>
  </aside>
);

const AssetRow: React.FC<{ asset: Asset; onClick: (a: Asset) => void }> = ({ asset, onClick }) => (
  <div 
    onClick={() => onClick(asset)}
    className="premium-card rounded-3xl p-4 flex items-center gap-6 cursor-pointer group"
  >
    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black flex-shrink-0 border border-white/5">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-lg text-white truncate group-hover:text-blue-400 transition-colors">{asset.title}</h3>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mt-1">@{asset.authorName}</p>
    </div>
    <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
      Download
    </button>
  </div>
);

// --- Main Views ---

const HomeView = ({ onSearch, searchQuery, filteredAssets, onAssetClick }: any) => (
  <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar relative px-12 pt-32 pb-24">
    <div className="glow-blue" />
    
    <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
      <div className="mb-20">
        <h1 className="text-[100px] font-black uppercase leading-[0.8] tracking-tighter">Find any</h1>
        <h1 className="text-[100px] font-black uppercase leading-[0.8] tracking-tighter text-ghost">Asset.</h1>
      </div>

      <div className="w-full relative mb-12">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search for models, scripts, maps..."
          className="w-full bg-[#111111]/50 border border-white/5 rounded-full py-8 px-12 text-xl focus:outline-none focus:border-white/20 transition-all text-center"
        />
        <div className="mt-6 flex justify-center gap-4">
          <div className="px-4 py-2 premium-card rounded-full text-[10px] font-bold text-zinc-500 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             999+ CREDITS LEFT
          </div>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 gap-4 mt-12">
        {filteredAssets.map((asset: Asset) => (
          <AssetRow key={asset.id} asset={asset} onClick={onAssetClick} />
        ))}
      </div>
    </div>
  </div>
);

const SettingsView = () => (
  <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar px-20 pt-32 pb-24">
    <div className="max-w-4xl">
      <div className="mb-12">
        <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400">Settings</span>
        <h1 className="text-5xl font-black uppercase tracking-tighter mt-4">Settings</h1>
        <p className="text-zinc-500 mt-2 font-medium">Configure your unique experience.</p>
      </div>

      <div className="space-y-6">
        <div className="premium-card rounded-[32px] p-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Icons.Model />
            </div>
            <div>
              <h3 className="font-bold text-xl">Asset Studio</h3>
              <p className="text-xs text-zinc-500 uppercase font-black tracking-widest mt-1">Global Rendering & DSP Presets</p>
            </div>
          </div>
          <Icons.Plus />
        </div>

        <div className="premium-card rounded-[32px] p-8 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl uppercase tracking-tighter">Download Quota (2H)</h3>
            <p className="text-xs text-zinc-500 font-medium mt-1 uppercase tracking-widest">Your current plan allows 50 downloads every 2 hours.</p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black">50</span>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Credits Left</p>
          </div>
        </div>

        <div className="pt-12">
          <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-8">Visual Aesthetics</h4>
          <div className="grid grid-cols-4 gap-4">
            {['Apple Arctic', 'Spotify', 'Cyberpunk', 'Oceanic'].map((theme, i) => (
              <div key={theme} className={`p-6 rounded-[24px] border border-white/5 transition-all cursor-pointer ${i === 0 ? 'bg-white text-black' : 'premium-card'}`}>
                <p className="text-[10px] font-black uppercase mb-4">{theme}</p>
                <div className="flex -space-x-2">
                   <div className={`w-8 h-8 rounded-full border-2 border-black ${i === 0 ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                   <div className={`w-8 h-8 rounded-full border-2 border-black ${i === 0 ? 'bg-black' : 'bg-zinc-700'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- App Root ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('blox_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [assets] = useState<Asset[]>(MOCK_ASSETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library' | 'settings'>('home');
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        const kws = await getSearchKeywords(searchQuery);
        setKeywords(kws);
      } else {
        setKeywords([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAssets = useMemo(() => {
    if (searchQuery === '') return assets;
    return assets.filter((asset) => {
      const lowerQuery = searchQuery.toLowerCase();
      return asset.title.toLowerCase().includes(lowerQuery) || keywords.some(kw => asset.title.toLowerCase().includes(kw.toLowerCase()));
    });
  }, [assets, searchQuery, keywords]);

  const handleLogin = () => {
    // Mock login para demonstração da UI
    const mockUser: User = {
      id: 'u_dev',
      name: 'Excalibur Dev',
      username: 'excalibur_premium',
      avatar: 'https://picsum.photos/seed/ex/200',
      provider: 'google',
      followers: [],
      following: []
    };
    setCurrentUser(mockUser);
    localStorage.setItem('blox_user', JSON.stringify(mockUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('blox_user');
  };

  return (
    <div className="flex bg-[#050505] min-h-screen">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {activeTab === 'home' || activeTab === 'search' ? (
        <HomeView 
          onSearch={setSearchQuery} 
          searchQuery={searchQuery} 
          filteredAssets={filteredAssets} 
          onAssetClick={setSelectedAsset}
        />
      ) : activeTab === 'settings' ? (
        <SettingsView />
      ) : (
        <div className="flex-grow ml-72 flex items-center justify-center">
          <p className="text-zinc-600 font-black uppercase tracking-[0.5em]">Module Under Construction</p>
        </div>
      )}
    </div>
  );
}
