const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GITHUB_TOKEN = process.env.WEBSHARE_TOKEN || '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';
const REPO_OWNER = 'kaio-adrik'; 
const REPO_NAME = 'aura-storage-cdn'; // Altere para o nome do seu repositório no GitHub

// Banco de dados em memória para manter o registro das pastas criadas
let foldersRegistry = [
    { id: "sample-123", name: "Default Design Folder", allowedCreator: "teacher@enaip.piemonte.it" }
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

/* --- API PARA REPOSITÓRIO DE FOTOS --- */

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
        // Puxa a lista de arquivos da pasta correspondente direto da API do GitHub
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/gallery/${folderId}`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        // Transforma o array de arquivos em links brutos (raw download urls) públicos
        const photoUrls = response.data
            .filter(file => file.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name))
            .map(file => file.download_url);

        res.json(photoUrls);
    } catch (error) {
        // Se a pasta ainda não tiver arquivos, o GitHub retorna 404, tratamos como lista vazia
        res.json([]);
    }
});

app.post('/api/upload', async (req, res) => {
    const { folderId, filename, content } = req.body;
    if(!folderId || !filename || !content) return res.status(400).send('Payload metadata complete drop.');

    // Sanitiza o nome do arquivo para evitar quebras de caminho Unix/Git
    const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
    const targetPath = `gallery/${folderId}/${cleanFilename}`;

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${targetPath}`;
        
        await axios.put(url, {
            message: `Cloud Upload via Aura Engine Node: ${cleanFilename}`,
            content: content
        }, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        res.status(200).send('Asset successfully synchronized into master branch.');
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).send(`GitHub Storage Communication Fault: ${error.message}`);
    }
});

// Suporte para SPA Routing no Vercel (Redireciona rotas de subdiretório fictício de volta para o index)
app.get('/photos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Active: http://localhost:${PORT}`));
}

module.exports = app;
