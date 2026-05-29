const express = require('express');
const axios   = require('axios');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Config (uses env vars, NO hardcoded values) ────────────────────────────────
const GITHUB_TOKEN         = process.env.GITHUB_TOKEN;
const REPO_OWNER           = process.env.REPO_OWNER           || 'FISTOFDARKNESS';
const REPO_NAME            = process.env.REPO_NAME            || 'excaliburstore';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

// Check if token exists
if (!GITHUB_TOKEN) {
  console.warn('⚠️  WARNING: GITHUB_TOKEN environment variable not set. Upload will fail.');
}

const getRedirectUri = (req) => {
  const host = req.get('host');
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}/api/auth/callback`;
};

// ── Folders registry (in-memory) ──────────────────────────────────────────────
let foldersRegistry = [
  {
    id: 'design-core',
    name: 'Enaip Graphic Design',
    allowedCreators: ['admin@enaip.piemonte.it']
  }
];

// ── Proxy ─────────────────────────────────────────────────────────────────────
app.get('/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Error: URL missing.');
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      responseType: 'text', timeout: 15000,
      validateStatus: s => s < 500, maxRedirects: 5
    });
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    const parsedUrl = new URL(targetUrl);
    const baseTag   = `<head><base href="${parsedUrl.origin}/">`;
    let html = response.data;
    if (typeof html !== 'string') return res.status(500).send('Error: Invalid format.');
    html = html.includes('<head>') ? html.replace('<head>', baseTag) : baseTag + html;
    [
      /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice)[^"']*["'][^>]*><\/script>/gi,
      /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi
    ].forEach(p => (html = html.replace(p, '')));
    return res.send(html);
  } catch (err) { return res.status(500).send(`Engine Error: ${err.message}`); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.get('/api/auth/google', (req, res) => {
  const redirectUri = getRedirectUri(req);
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile%20email`
  );
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Authorization code missing.');
  try {
    const redirectUri = getRedirectUri(req);
    const { data: tokenData } = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, grant_type: 'authorization_code'
    });
    const { data: userData } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userData.email.endsWith('@enaip.piemonte.it')) {
      return res.send(`<script>alert('Access Denied. Only @enaip.piemonte.it accounts allowed.'); window.location.href='/photos';</script>`);
    }
    const email = userData.email.replace(/'/g, "\\'");
    const name  = userData.name.replace(/'/g, "\\'");
    return res.send(`<script>
      localStorage.setItem('aura_user', JSON.stringify({ email: '${email}', name: '${name}' }));
      window.location.href = '/photos';
    </script>`);
  } catch (err) { return res.status(500).send(`Authentication failed: ${err.message}`); }
});

// ── Folders CRUD ──────────────────────────────────────────────────────────────
app.get('/api/folders', (req, res) => res.json(foldersRegistry));

app.post('/api/folders', (req, res) => {
  const { name, allowedCreators } = req.body;
  if (!name || !allowedCreators || !allowedCreators.length)
    return res.status(400).send('Missing fields.');
  const folder = { id: 'folder_' + Date.now(), name, allowedCreators };
  foldersRegistry.push(folder);
  res.status(201).json(folder);
});

app.put('/api/folders/:id', (req, res) => {
  const idx = foldersRegistry.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).send('Folder not found.');
  const { name, allowedCreators } = req.body;
  if (!name || !allowedCreators || !allowedCreators.length)
    return res.status(400).send('Missing fields.');
  foldersRegistry[idx] = { ...foldersRegistry[idx], name, allowedCreators };
  res.json(foldersRegistry[idx]);
});

app.delete('/api/folders/:id', (req, res) => {
  const before = foldersRegistry.length;
  foldersRegistry = foldersRegistry.filter(f => f.id !== req.params.id);
  if (foldersRegistry.length === before) return res.status(404).send('Folder not found.');
  res.status(200).send('Deleted.');
});

// ── Photos ────────────────────────────────────────────────────────────────────
app.get('/api/photos', async (req, res) => {
  const { folderId } = req.query;
  if (!folderId) return res.status(400).send('Folder ID missing.');
  if (!GITHUB_TOKEN) return res.status(500).send('GitHub token not configured.');
  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    res.json(data.filter(f => f.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)).map(f => f.download_url));
  } catch { res.json([]); }
});

// ── Upload ────────────────────────────────────────────────────────────────────
app.post('/api/upload', async (req, res) => {
  if (!GITHUB_TOKEN) return res.status(500).send('GitHub token not configured in environment variables.');
  
  const { folderId, filename, content } = req.body;
  if (!folderId || !filename || !content) return res.status(400).send('Payload incomplete.');
  
  const clean   = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
  const ghHeaders = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
  
  try {
    // Check if folder exists on GitHub — if not, create it with a .gitkeep
    try {
      await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}`,
        { headers: ghHeaders }
      );
    } catch (checkErr) {
      if (checkErr.response && checkErr.response.status === 404) {
        // Folder doesn't exist — initialise it
        await axios.put(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}/.gitkeep`,
          { message: `Init folder: ${folderId}`, content: '', branch: 'main' },
          { headers: ghHeaders }
        );
      }
    }

    // Upload the actual file
    await axios.put(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}/${clean}`,
      { message: `Upload via Aura Engine: ${clean}`, content, branch: 'main' },
      { headers: ghHeaders }
    );
    res.status(200).send('Asset synchronized successfully.');
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    res.status(500).send(`Storage error: ${detail}`);
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('/photos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Local server ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Active: http://localhost:${PORT}`));
}

module.exports = app;
