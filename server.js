const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static front-end assets cleanly
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    let targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Error: URL parameter is missing.');
    }

    // Force protocol normalization to prevent initialization crashes
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        // Execute request through an isolated instance with custom request headers
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            },
            responseType: 'text',
            timeout: 15000, // Prevent Vercel execution timeouts (Max 15s)
            validateStatus: (status) => status < 500, // Process standard redirects/errors without throwing Axios exception
            maxRedirects: 5
        });

        // Strip incoming client security rules that block iframe execution
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Content-Type-Options');
        
        // Match the structural content-type payload
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        // Parse origin URL to accurately rebuild broken relative paths
        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', baseTag);
            } else {
                modifiedHtml = baseTag + modifiedHtml;
            }
            return res.send(modifiedHtml);
        } else {
            return res.status(500).send('Error: Target responded with an unrenderable data format.');
        }

    } catch (error) {
        // Log explicitly to Vercel Console and gracefully respond to the front-end UI
        console.error(`[Proxy Exception]: ${error.message}`);
        return res.status(500).send(`Engine Error: Unable to resolve target node. Details: ${error.message}`);
    }
});

// Run execution listener ONLY during native local environment development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`[Proxy Active] Direct access via: http://localhost:${PORT}`);
    });
}

// Export module engine instance for standard Vercel Serverless Function lifecycle
module.exports = app;
