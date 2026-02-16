
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, User } from './types';
import { MOCK_ASSETS, Icons } from './constants';
import { getSearchKeywords } from './services/geminiService';

// --- Componentes de Interface ---

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
  <aside className="w-72 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-8 z-50 bg-[#050505]">
    <div className="flex items-center gap-3 mb-16">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
        </svg>
      </div>
      <span className="font-black uppercase tracking-tighter text-xl italic">EXCALIBUR</span>
    </div>

    <nav className="flex-grow space-y-3">
      {[
        { id: 'home', label: 'HOME', icon: <Icons.Model /> },
        { id: 'search', label: 'CLOUD SEARCH', icon: <Icons.Search /> },
        { id: 'library', label: 'LIBRARY', icon: <Icons.Script /> },
        { id: 'playlists', label: 'PLAYLISTS', icon: <Icons.Plus /> },
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
      <button className="w-full bg-[#facc15] text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all">
        <Icons.Like filled />
        PREMIUM
      </button>
      <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-5 py-3 text-[11px] font-black tracking-widest transition-all ${activeTab === 'settings' ? 'text-white' : 'text-zinc-600 hover:text-white'}`}>
        <Icons.Plus />
        SETTINGS
      </button>
    </div>
  </aside>
);

const AssetRow: React.FC<{ asset: Asset; onClick: (a: Asset) => void }> = ({ asset, onClick }) => (
  <div 
    onClick={() => onClick(asset)}
    className="premium-card rounded-[32px] p-5 flex items-center gap-6 cursor-pointer group w-full"
  >
    <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-xl text-white truncate group-hover:text-blue-400 transition-colors tracking-tight">{asset.title}</h3>
      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">{asset.authorName}</p>
    </div>
    <div className="flex items-center gap-3">
       <button className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2">
         <Icons.Download />
         DOWNLOAD
       </button>
    </div>
  </div>
);

// --- Views ---

const HomeView = ({ onSearch, searchQuery, filteredAssets, onAssetClick }: any) => (
  <div className="flex-grow ml-72 h-screen overflow-y-auto custom-scrollbar relative px-12 pt-32 pb-24 z-10">
    <div className="glow-blue" />
    
    <div className="max-w-4xl mx-auto flex flex-col items-center">
      <div className="text-center mb-16">
        <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter">Find any</h1>
        <h1 className="text-[110px] font-black uppercase leading-[0.8] tracking-tighter text-ghost">Asset.</h1>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        <div className="relative group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search for scripts, maps, models..."
            className="w-full search-pill rounded-full py-8 px-12 text-2xl font-semibold focus:outline-none focus:border-white/10 transition-all text-center placeholder:text-zinc-800"
          />
        </div>
        
        <div className="flex justify-center">
          <div className="px-5 py-2.5 premium-card rounded-full text-[10px] font-black tracking-widest text-zinc-500 flex items-center gap-3 border-white/5">
             <Icons.Script />
             15 CREDITS LEFT
          </div>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 gap-5 mt-24">
        {filteredAssets.length > 0 ? (
          filteredAssets.map((asset: Asset) => (
            <AssetRow key={asset.id} asset={asset} onClick={onAssetClick} />
          ))
        ) : (
          <div className="py-20 text-center text-zinc-800 font-black uppercase tracking-[1em]">Empty Database</div>
        )}
      </div>
    </div>
  </div>
);

// --- Root ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('blox_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [assets] = useState<Asset[]>(MOCK_ASSETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        const kws = await getSearchKeywords(searchQuery);
        setKeywords(kws);
      } else {
        setKeywords([]);
      }
    }, 600);
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
    <div className="flex bg-[#050505] min-h-screen text-white">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <HomeView 
        onSearch={setSearchQuery} 
        searchQuery={searchQuery} 
        filteredAssets={filteredAssets} 
        onAssetClick={(a: any) => console.log("Asset Clicked:", a)}
      />
    </div>
  );
}
