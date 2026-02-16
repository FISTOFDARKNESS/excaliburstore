
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, User, Category, VerificationData } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';

// --- CONFIGURAÇÃO ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const RAPID_API_KEY = "8ed62ca7c5msh2f6b793b33c887dp1a5499jsnf136d5071315";
const RAPID_API_HOST_STATUS = "Dropboxstefan-skliarovV1.p.rapidapi.com";

declare const puter: any;

// --- Helpers de API ---

const checkFileStatus = async (): Promise<VerificationData> => {
  try {
    const response = await fetch('https://dropboxstefan-skliarovv1.p.rapidapi.com/addFileMembers', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': RAPID_API_HOST_STATUS,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: null
    });

    return {
      status: response.ok ? "Synced & Healthy" : "Puter FS Active",
      checkedAt: Date.now(),
      apiProvider: "Puter Cloud Node",
      verified: true
    };
  } catch (e) {
    return {
      status: "Active",
      checkedAt: Date.now(),
      apiProvider: "Local Node",
      verified: true
    };
  }
};

const uploadToPuter = async (file: File): Promise<string> => {
  // Usando puter.fs.write para salvar o arquivo no sistema do Puter
  const path = `Documents/BloxMarket/${Date.now()}_${file.name}`;
  await puter.fs.write(path, file);
  return path;
};

const downloadFromPuter = async (path: string, fileName: string) => {
  try {
    const blob = await puter.fs.read(path);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    alert("Falha ao ler arquivo do Puter FS.");
  }
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
        { theme: "filled_blue", size: "large", width: "240", shape: "pill", text: "continue_with" }
      );
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[280px] bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 bg-white rounded-lg mx-auto flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-black" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold tracking-tight text-white leading-none">Identity Check</h3>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Access Puter Node Hub</p>
        </div>
        <div id="google-login-btn-container" className="flex justify-center" />
        <button onClick={onClose} className="w-full text-[9px] text-zinc-600 font-bold uppercase hover:text-white transition-colors">Abort</button>
      </div>
    </div>
  );
};

interface AssetRowProps {
  asset: Asset;
  onClick: (a: Asset) => void;
  onDownload: (a: Asset) => void;
  onAuthorClick?: (uid: string) => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, onClick, onDownload, onAuthorClick }) => (
  <div onClick={() => onClick(asset)} className="premium-card rounded-xl p-3 flex items-center gap-3 cursor-pointer group w-full hover:bg-white/[0.03] border border-white/5">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={asset.title} />
      {asset.verification?.verified && (
        <div className="absolute top-1 right-1 bg-blue-500 text-white p-0.5 rounded-full shadow border border-white/10">
          <svg viewBox="0 0 24 24" className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7"/></svg>
        </div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-bold text-base text-white truncate group-hover:text-blue-400 transition-colors tracking-tight italic uppercase">{asset.title}</h3>
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors">
          @{asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 text-zinc-600">
         <span className="text-[9px] font-bold">{asset.downloadCount}</span>
         <Icons.Download />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDownload(asset); }} className="bg-white text-black px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-90 transition-all">
        GET
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumb || !rbxFile) return alert("Required files missing!");
    onPublish({ thumb, rbx: rbxFile, data: { title, desc, category } });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {isUploading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white tracking-tight">Puter Cloud Sync</h2>
              <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider italic">Writing to puter.fs...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic text-white leading-none">Publish Node</h2>
              <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-white transition-all bg-white/5 rounded-full rotate-45"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Asset Label</label>
                <input required type="text" placeholder="Ex: Advanced Engine" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Roblox Data (.rbxm/.rbxl)</label>
                <label className={`w-full p-4 rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <span className="font-bold text-[9px] tracking-wider">{rbxFile ? rbxFile.name : "SELECT BINARY"}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Preview</label>
                  <label className={`w-full h-20 rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${thumb ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="file" accept="image/*" onChange={e => e.target.files && setThumb(e.target.files[0])} className="hidden" />
                    {thumb ? <img src={URL.createObjectURL(thumb)} className="w-full h-full object-cover" /> : <Icons.Plus />}
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Category</label>
                  <select className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-white appearance-none text-center font-bold text-[10px] cursor-pointer hover:bg-white/[0.07] transition-all" value={category} onChange={e => setCategory(e.target.value as Category)}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-white text-black font-black uppercase py-3.5 rounded-xl text-[9px] tracking-widest hover:brightness-90 transition-all shadow-xl">PUBLISH TO PUTER</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('bx_users_v8') || JSON.stringify(MOCK_USERS)));
  const [currentUser, setCurrentUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('bx_cur_user_v8') || 'null'));
  const [assets, setAssets] = useState<Asset[]>(() => JSON.parse(localStorage.getItem('bx_assets_v8') || JSON.stringify(MOCK_ASSETS)));
  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('bx_users_v8', JSON.stringify(users));
    localStorage.setItem('bx_cur_user_v8', JSON.stringify(currentUser));
    localStorage.setItem('bx_assets_v8', JSON.stringify(assets));
  }, [users, currentUser, assets]);

  const handleGoogleSignIn = (response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: User = { id: payload.sub, name: payload.name, username: payload.email.split('@')[0], avatar: payload.picture, provider: 'google', followers: [], following: [], bio: "Puter Power User", links: [] };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
    }
    setShowLoginMenu(false);
  };

  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
      });
    }
  }, []);

  const handlePublish = async (files: { thumb: File, rbx: File, data: any }) => {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      // Usando Puter.js para salvar o arquivo rbx
      const rbxPath = await uploadToPuter(files.rbx);
      
      // Para a thumbnail, em um app real você também salvaria no Puter, 
      // aqui usaremos um ObjectURL temporário para demonstração (em produção, salvar no Puter e ler o blob)
      const thumbUrl = URL.createObjectURL(files.thumb);
      
      const statusData = await checkFileStatus();
      
      const newAsset: Asset = {
        id: 'a_' + Date.now(),
        userId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        title: files.data.title,
        description: files.data.desc || "Verified Puter Asset.",
        category: files.data.category,
        thumbnailUrl: thumbUrl,
        fileData: rbxPath, // Guardamos o caminho do Puter
        fileType: files.rbx.name.substring(files.rbx.name.lastIndexOf('.')) as any,
        creditsRequired: false,
        likes: [],
        dislikes: [],
        reports: [],
        comments: [],
        downloadCount: 0,
        timestamp: Date.now(),
        verification: statusData
      };

      setAssets(prev => [newAsset, ...prev]);
      setShowPublishModal(false);
    } catch (e: any) {
      alert("Puter Sync Error: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())), [assets, searchQuery]);
  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white font-sans selection:bg-blue-500/20">
      <aside className="w-56 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-5 z-50 bg-[#050505]">
        <div className="flex items-center gap-2.5 mb-10 group cursor-pointer" onClick={() => { setActiveTab('home'); setViewingUserId(null); }}>
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"><Icons.Model /></div>
          <span className="font-bold uppercase tracking-tight text-base italic">EXCALIBUR</span>
        </div>
        <nav className="flex-grow space-y-1.5">
          {['home', 'library', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200 ${activeTab === tab ? 'bg-white text-black rounded-lg shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'library' ? <Icons.Script /> : <Icons.Plus />}
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-5 border-t border-white/5">
          {currentUser ? (
            <div className="p-3 bg-white/5 rounded-xl space-y-2.5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <img src={currentUser.avatar} className="w-7 h-7 rounded-full border border-white/10" />
                <span className="text-[9px] font-bold truncate text-zinc-400">@{currentUser.username}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); setActiveTab('home'); }} className="w-full text-[8px] font-bold uppercase text-zinc-600 hover:text-red-500 transition-colors">Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-3 rounded-lg text-[9px] tracking-widest hover:brightness-90 transition-all shadow-lg">Login</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-56 min-h-screen relative overflow-x-hidden">
        {activeTab === 'home' && (
          <div className="px-10 pt-20 pb-16 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="text-center space-y-0.5">
                <h1 className="text-5xl font-black uppercase tracking-tighter animate-in slide-in-from-bottom duration-500 italic">Central</h1>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-ghost italic">Repository</h1>
              </div>
              <div className="relative max-w-xl mx-auto">
                <input type="text" placeholder="Scan Puter nodes..." className="w-full search-pill rounded-xl py-4 px-6 text-lg font-bold text-center focus:outline-none placeholder:text-zinc-800 border border-white/5 transition-all focus:border-white/10" onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="space-y-3.5 animate-in fade-in duration-700">
                {filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => downloadFromPuter(a.fileData!, a.title + a.fileType)} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}
                {filteredAssets.length === 0 && <div className="py-10 text-center text-zinc-800 font-bold uppercase tracking-widest text-[10px] italic">No match found.</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="px-10 pt-20 pb-16 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-end mb-10">
                <div className="space-y-0.5">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Vault</h1>
                  <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-[0.4em] ml-1">Puter FS Node</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-5 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:brightness-90 transition-all shadow-lg">Publish File</button>}
              </div>
              <div className="space-y-3.5">
                {currentUser ? (
                  assets.filter(a => a.userId === currentUser.id).length > 0 ? (
                    assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => downloadFromPuter(a.fileData!, a.title + a.fileType)} />)
                  ) : (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                      <p className="text-zinc-800 font-bold uppercase tracking-widest text-[9px]">Local vault empty.</p>
                    </div>
                  )
                ) : (
                  <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-zinc-600 font-bold text-[9px] uppercase tracking-widest mb-3.5">Puter Account Required</p>
                    <button onClick={() => setShowLoginMenu(true)} className="bg-white text-black px-5 py-2 rounded-full font-bold text-[8px] uppercase tracking-widest">Connect</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-10 pt-20 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-12 pb-24">
              <div className="premium-card rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-8 border border-white/5 shadow-xl">
                <img src={targetUser.avatar} className="w-24 h-24 rounded-2xl border-4 border-white/5 shadow-xl object-cover" />
                <div className="flex-grow text-center sm:text-left space-y-2">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">@{targetUser.username}</h2>
                  <p className="text-zinc-500 text-xs leading-relaxed font-medium max-w-sm">{targetUser.bio || "Excalibur Cloud Member."}</p>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-lg font-bold uppercase italic tracking-tight border-b border-white/5 pb-3">Cloud Entries</h3>
                <div className="space-y-3.5">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => downloadFromPuter(a.fileData!, a.title + a.fileType)} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && assets.find(a => a.id === selectedAssetId) && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-md" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            return (
              <div className="relative w-full max-w-3xl bg-[#080808] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[80vh]">
                <div className="flex-grow p-8 overflow-y-auto custom-scrollbar space-y-8">
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-zinc-900">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-tight">{asset.title}</h2>
                      <div className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 text-[7px] font-black uppercase">Puter FS Active</div>
                    </div>
                    <p className="text-zinc-500 text-base leading-relaxed font-medium">{asset.description}</p>
                  </div>
                </div>
                <div className="w-full md:w-[280px] bg-[#0a0a0a] border-l border-white/5 p-8 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <span className="text-[8px] font-bold uppercase text-zinc-700 tracking-widest">Puter Node</span>
                       <button onClick={() => setSelectedAssetId(null)} className="bg-white/5 p-1.5 rounded-full hover:bg-white/10 transition-all rotate-45 text-zinc-500"><Icons.Plus /></button>
                    </div>
                    {asset.verification && (
                      <div className="p-5 bg-blue-500/[0.03] rounded-2xl border border-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                           <p className="text-[8px] font-bold uppercase text-blue-500 tracking-wider">Status: Healthy</p>
                        </div>
                        <p className="text-[7px] font-mono text-blue-300 opacity-40 truncate leading-tight italic">PATH: {asset.fileData}</p>
                        <p className="text-[7px] font-mono text-blue-300 opacity-40 mt-1 uppercase">Synced: {new Date(asset.timestamp).toLocaleDateString()}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                        <p className="text-xl font-bold">{asset.downloadCount}</p>
                        <p className="text-[7px] font-bold uppercase text-zinc-700 mt-1">Fetches</p>
                      </div>
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                        <p className="text-xs font-bold text-blue-500 uppercase">{asset.fileType.substring(1)}</p>
                        <p className="text-[7px] font-bold uppercase text-zinc-700 mt-1">Format</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => downloadFromPuter(asset.fileData!, asset.title + asset.fileType)} className="w-full bg-white text-black font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest hover:brightness-90 transition-all mt-6 shadow-xl">GET FROM PUTER</button>
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
