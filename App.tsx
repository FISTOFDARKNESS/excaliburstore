
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, User, Comment, Category, EncryptionData } from './types';
import { MOCK_ASSETS, MOCK_USERS, Icons } from './constants';

// --- CONFIGURAÇÃO ---
const GOOGLE_CLIENT_ID = "308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com";
const RAPID_API_KEY = "8ed62ca7c5msh2f6b793b33c887dp1a5499jsnf136d5071315";
const RAPID_API_HOST_UPLOAD = "upload.p.rapidapi.com";
const RAPID_API_HOST_CRYPT = "cryptify.p.rapidapi.com";
const UPLOADCARE_PUB_KEY = "demopublickey";

// --- Helpers de API ---

const generateKeyPair = async (): Promise<EncryptionData> => {
  const response = await fetch('https://cryptify.p.rapidapi.com/api/generate-key-pair?algorithm=RSA&size=2048', {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': RAPID_API_HOST_CRYPT
    }
  });
  if (!response.ok) throw new Error("Falha ao gerar chaves de segurança");
  const result = await response.json();
  return {
    publicKey: result.public_key,
    privateKey: result.private_key,
    algorithm: result.algorithm,
    keySize: result.key_size
  };
};

const uploadToCloud = async (file: File): Promise<string> => {
  const data = new FormData();
  data.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUB_KEY);
  data.append('file', file);
  data.append('UPLOADCARE_STORE', '1');

  const response = await fetch('https://upload.p.rapidapi.com/base/', {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': RAPID_API_HOST_UPLOAD
    },
    body: data
  });

  if (!response.ok) throw new Error("Upload falhou");
  const result = await response.json();
  return `https://ucarecdn.com/${result.file}/`;
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
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 space-y-8 shadow-2xl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-black" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </div>
          <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Identity Check</h3>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em]">Connect to the Excalibur Network</p>
        </div>
        <div id="google-login-btn-container" className="flex justify-center" />
        <button onClick={onClose} className="w-full text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Abort Access</button>
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
  <div onClick={() => onClick(asset)} className="premium-card rounded-[32px] p-6 flex items-center gap-8 cursor-pointer group w-full hover:border-white/20 transition-all">
    <div className="w-28 h-28 rounded-[28px] overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 relative">
      <img src={asset.thumbnailUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={asset.title} />
      {asset.encryption && (
        <div className="absolute bottom-2 left-2 bg-blue-500/80 backdrop-blur-sm p-1.5 rounded-lg border border-white/10">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
      )}
    </div>
    <div className="flex-grow min-w-0">
      <h3 className="font-black text-2xl text-white truncate group-hover:text-blue-400 transition-colors tracking-tighter italic uppercase">{asset.title}</h3>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={(e) => { e.stopPropagation(); onAuthorClick?.(asset.userId); }} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-colors">
          {asset.authorName}
        </button>
        <span className="text-zinc-800">/</span>
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-[0.2em]">{asset.category}</span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-3 text-zinc-700">
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumb || !rbxFile) return alert("All files required!");
    onPublish({ thumb, rbx: rbxFile, data: { title, desc, category } });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[48px] p-12 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        {isUploading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-8 text-center">
            <div className="w-20 h-20 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin" />
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter">Securing Asset</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Generating RSA Keypair & Uploading...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">Sign New Asset</h2>
              <button onClick={onClose} className="p-3 text-zinc-600 hover:text-white transition-all bg-white/5 rounded-full"><Icons.Plus /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Identifier</label>
                <input required type="text" placeholder="Title of the creation" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Source File (.rbxm, .rbxl, .rbxmx)</label>
                <label className={`w-full p-10 rounded-[32px] border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${rbxFile ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}>
                  <input type="file" accept=".rbxm,.rbxl,.rbxmx" onChange={e => e.target.files && setRbxFile(e.target.files[0])} className="hidden" />
                  <Icons.Script />
                  <span className="font-black text-[10px] uppercase tracking-[0.2em] mt-4">{rbxFile ? rbxFile.name : "DEPOSIT ROBLOX FILE"}</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-4">Preview Image</label>
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

              <button type="submit" className="w-full bg-white text-black font-black uppercase py-7 rounded-[32px] text-xs tracking-[0.5em] hover:scale-[1.01] transition-all shadow-2xl">ENCRYPT & PUBLISH</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => JSON.parse(localStorage.getItem('bx_users_v6') || JSON.stringify(MOCK_USERS)));
  const [currentUser, setCurrentUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('bx_cur_user_v6') || 'null'));
  const [assets, setAssets] = useState<Asset[]>(() => JSON.parse(localStorage.getItem('bx_assets_v6') || JSON.stringify(MOCK_ASSETS)));
  const [activeTab, setActiveTab] = useState('home');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('bx_users_v6', JSON.stringify(users));
    localStorage.setItem('bx_cur_user_v6', JSON.stringify(currentUser));
    localStorage.setItem('bx_assets_v6', JSON.stringify(assets));
  }, [users, currentUser, assets]);

  const handleGoogleSignIn = (response: any) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    const existing = users.find(u => u.id === payload.sub);
    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: User = { id: payload.sub, name: payload.name, username: payload.email.split('@')[0], avatar: payload.picture, provider: 'google', followers: [], following: [], bio: "Excalibur Developer", links: [] };
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
      const [thumbUrl, rbxUrl, keys] = await Promise.all([
        uploadToCloud(files.thumb),
        uploadToCloud(files.rbx),
        generateKeyPair()
      ]);
      
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
        creditsRequired: false,
        likes: [],
        dislikes: [],
        reports: [],
        comments: [],
        downloadCount: 0,
        timestamp: Date.now(),
        encryption: keys
      };

      setAssets(prev => [newAsset, ...prev]);
      setShowPublishModal(false);
      alert(`Asset Published!\n\nYOUR PRIVATE KEY (SAVE THIS): ${keys.privateKey?.substring(0, 32)}...`);
    } catch (e: any) {
      alert("Encryption/Upload Error: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredAssets = useMemo(() => assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())), [assets, searchQuery]);
  const targetUser = useMemo(() => viewingUserId ? users.find(u => u.id === viewingUserId) : currentUser, [users, viewingUserId, currentUser]);

  return (
    <div className="flex bg-[#050505] min-h-screen text-white">
      <aside className="w-80 h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-10 z-50 bg-[#050505]">
        <div className="flex items-center gap-4 mb-20">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center"><Icons.Model /></div>
          <span className="font-black uppercase tracking-tighter text-2xl italic">EXCALIBUR</span>
        </div>
        <nav className="flex-grow space-y-4">
          {['home', 'library', 'profile'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setViewingUserId(null); }} className={`w-full flex items-center gap-6 px-6 py-4 text-[12px] font-black tracking-[0.3em] uppercase transition-all ${activeTab === tab ? 'bg-white text-black rounded-2xl' : 'text-zinc-600 hover:text-white'}`}>
              {tab === 'home' ? <Icons.Search /> : tab === 'library' ? <Icons.Script /> : <Icons.Plus />}
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-10 border-t border-white/5">
          {currentUser ? (
            <div className="p-6 bg-white/5 rounded-3xl space-y-4">
              <div className="flex items-center gap-4">
                <img src={currentUser.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                <span className="text-[11px] font-black uppercase truncate">{currentUser.username}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); setActiveTab('home'); }} className="w-full text-[10px] font-black uppercase text-zinc-600 hover:text-red-500">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => setShowLoginMenu(true)} className="w-full bg-white text-black font-black uppercase py-5 rounded-[24px] text-[11px] tracking-[0.3em] hover:scale-105 transition-all">Authenticate</button>
          )}
        </div>
      </aside>

      <main className="flex-grow ml-80 min-h-screen relative">
        {activeTab === 'home' && (
          <div className="px-24 pt-40 pb-32 h-screen overflow-y-auto custom-scrollbar">
            <div className="glow-accent" />
            <div className="max-w-5xl mx-auto text-center space-y-24">
              <div className="space-y-0">
                <h1 className="text-[160px] font-black uppercase leading-[0.6] tracking-tighter animate-in slide-in-from-bottom duration-700">Digital</h1>
                <h1 className="text-[160px] font-black uppercase leading-[0.6] tracking-tighter text-ghost">Market</h1>
              </div>
              <input type="text" placeholder="Search signed assets..." className="w-full search-pill rounded-full py-12 px-20 text-4xl font-black text-center focus:outline-none placeholder:text-zinc-900 border-none transition-all" onChange={e => setSearchQuery(e.target.value)} />
              <div className="space-y-8 text-left">{filteredAssets.map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => window.open(a.fileData, '_blank')} onAuthorClick={uid => { setViewingUserId(uid); setActiveTab('profile'); }} />)}</div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="px-24 pt-40 pb-32 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-end mb-24">
                <div className="space-y-4">
                  <h1 className="text-8xl font-black uppercase italic tracking-tighter leading-none">The Vault</h1>
                  <p className="text-zinc-600 text-xs font-black uppercase tracking-[0.6em] ml-2">Personal Encrypted Repository</p>
                </div>
                {currentUser && <button onClick={() => setShowPublishModal(true)} className="bg-white text-black px-12 py-5 rounded-[28px] font-black uppercase text-[12px] tracking-[0.4em] hover:scale-105 transition-all">Sign New</button>}
              </div>
              <div className="space-y-8">
                {currentUser ? assets.filter(a => a.userId === currentUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => window.open(a.fileData, '_blank')} />) : <p className="text-center py-40 text-zinc-800 font-black uppercase tracking-widest">Login required to access the vault</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && targetUser && (
          <div className="px-24 pt-40 h-screen overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-20 pb-40">
              <div className="premium-card rounded-[64px] p-20 flex flex-col lg:flex-row items-center gap-20 relative overflow-hidden">
                <div className="glow-accent" />
                <img src={targetUser.avatar} className="w-64 h-64 rounded-full border-8 border-white/5 relative z-10 shadow-2xl" />
                <div className="flex-grow z-10 space-y-6 text-center lg:text-left">
                  <h2 className="text-8xl font-black uppercase italic tracking-tighter leading-none">@{targetUser.username}</h2>
                  <p className="text-zinc-400 text-xl leading-relaxed font-medium max-w-2xl">{targetUser.bio || "Excalibur Verified Creator Network Member."}</p>
                </div>
              </div>
              <div className="space-y-10">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter border-b border-white/5 pb-6">Authenticated Creations</h3>
                <div className="space-y-8">{assets.filter(a => a.userId === targetUser.id).map(a => <AssetRow key={a.id} asset={a} onClick={a => setSelectedAssetId(a.id)} onDownload={a => window.open(a.fileData, '_blank')} />)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedAssetId && assets.find(a => a.id === selectedAssetId) && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setSelectedAssetId(null)} />
          {(() => {
            const asset = assets.find(a => a.id === selectedAssetId)!;
            return (
              <div className="relative w-full max-w-6xl bg-[#080808] border border-white/10 rounded-[72px] shadow-2xl overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
                <div className="flex-grow p-16 overflow-y-auto custom-scrollbar space-y-12">
                  <div className="aspect-video w-full rounded-[48px] overflow-hidden border border-white/5 shadow-2xl bg-zinc-900">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-6xl font-black uppercase italic tracking-tighter">{asset.title}</h2>
                    <p className="text-zinc-500 text-xl leading-relaxed whitespace-pre-line">{asset.description}</p>
                  </div>
                </div>
                <div className="w-full lg:w-[450px] bg-[#0a0a0a] border-l border-white/5 p-16 flex flex-col justify-between">
                  <div className="space-y-12">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-zinc-700 tracking-[0.4em]">Metadata Node</span>
                       <button onClick={() => setSelectedAssetId(null)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition-all rotate-45"><Icons.Plus /></button>
                    </div>
                    {asset.encryption && (
                      <div className="space-y-4 p-8 bg-blue-500/5 rounded-[32px] border border-blue-500/10">
                        <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.4em]">RSA Security ID</p>
                        <p className="text-[9px] font-mono break-all text-blue-300 opacity-60 leading-tight">{asset.encryption.publicKey.substring(0, 150)}...</p>
                        <div className="flex gap-4 mt-2">
                           <span className="text-[9px] font-black text-white/40 uppercase">ALG: {asset.encryption.algorithm}</span>
                           <span className="text-[9px] font-black text-white/40 uppercase">SIZE: {asset.encryption.keySize}</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="premium-card p-8 rounded-[32px] text-center">
                        <p className="text-4xl font-black">{asset.downloadCount}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-700 mt-2">Fetches</p>
                      </div>
                      <div className="premium-card p-8 rounded-[32px] text-center">
                        <p className="text-xl font-black text-blue-500">{asset.fileType}</p>
                        <p className="text-[9px] font-black uppercase text-zinc-700 mt-2">Format</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => window.open(asset.fileData, '_blank')} className="w-full bg-white text-black font-black uppercase py-8 rounded-[32px] text-sm tracking-[0.6em] hover:brightness-110 active:scale-95 transition-all shadow-2xl mt-12">GET FILE</button>
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
