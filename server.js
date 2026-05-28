const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GITHUB_TOKEN = process.env.WEBSHARE_TOKEN || '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';
const REPO_OWNER = 'FISTOFDARKNESS'; 
const REPO_NAME = 'excaliburstore'; 

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
    ? 'https://excaliburlinks.vercel.app/api/auth/callback' 
    : 'http://localhost:3000/api/auth/callback';

let foldersRegistry = [
    { id: "design-core", name: "Enaip Graphic Design", allowedCreator: "admin@enaip.piemonte.it" }
];

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
            responseType: 'text',
            timeout: 15000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
        });

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });

        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            modifiedHtml = modifiedHtml.includes('<head>') ? modifiedHtml.replace('<head>', baseTag) : baseTag + modifiedHtml;
            const adPatterns = [
                /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice)[^"']*["'][^>]*><\/script>/gi,
                /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi
            ];
            adPatterns.forEach(pattern => modifiedHtml = modifiedHtml.replace(pattern, ''));
            return res.send(modifiedHtml);
        }
        return res.status(500).send('Error: Invalid format.');
    } catch (error) {
        return res.status(500).send(`Engine Error: ${error.message}`);
    }
});

app.get('/api/auth/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=profile%20email`;
    res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Authorization code missing.');

    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        });

        const { access_token } = tokenResponse.data;

        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const userData = userResponse.data;

        if (!userData.email.endsWith('@enaip.piemonte.it')) {
            return res.send(`<script>alert('Access Denied. Only @enaip.piemonte.it accounts allowed.'); window.location.href='/photos';</script>`);
        }

        res.send(`<script>
            localStorage.setItem('aura_user', JSON.stringify({ email: '${userData.email}', name: '${userData.name}' }));
            window.location.href = '/photos';
        </script>`);
    } catch (error) {
        res.status(500).send('Authentication failed.');
    }
});

app.get('/api/folders', (req, res) => {
    res.json(foldersRegistry);
});

app.post('/api/folders', (req, res) => {
    const { name, allowedCreator } = req.body;
    if(!name || !allowedCreator) return res.status(400).send('Missing fields.');
    
    const newFolder = {
        id: 'folder_' + Date.now(),
        name,
        allowedCreator
    };
    foldersRegistry.push(newFolder);
    res.status(201).json(newFolder);
});

app.get('/api/photos', async (req, res) => {
    const { folderId } = req.query;
    if(!folderId) return res.status(400).send('Folder ID missing.');

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        const photoUrls = response.data
            .filter(file => file.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name))
            .map(file => file.download_url);

        res.json(photoUrls);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/upload', async (req, res) => {
    const { folderId, filename, content } = req.body;
    if(!folderId || !filename || !content) return res.status(400).send('Payload incomplete.');

    const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
    const targetPath = `gallery/${folderId}/${cleanFilename}`;

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${targetPath}`;
        
        await axios.put(url, {
            message: `Upload via Aura Engine: ${cleanFilename}`,
            content: content,
            branch: 'main'
        }, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        res.status(200).send('Asset synchronized successfully.');
    } catch (error) {
        res.status(500).send(`Storage error: ${error.message}`);
    }
});

app.get('/photos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Active: http://localhost:${PORT}`));
}

module.exports = app;
    
