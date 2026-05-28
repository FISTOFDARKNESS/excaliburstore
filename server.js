const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    let targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Error: URL parameter is missing.');
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            },
            responseType: 'text',
            timeout: 15000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
        });

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Content-Type-Options');
        
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', baseTag);
            } else {
                modifiedHtml = baseTag + modifiedHtml;
            }
            
            const adPatterns = [
                /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice|adbrite|exponential|popads|propellerads|juicyads|exoclick|onclickads)[^"']*["'][^>]*><\/script>/gi,
                /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi,
                /<script\b[^>]*>([\s\S]*?)(adsbygoogle|window\.adsbygoogle|amazon-adsystem|popunder)([\s\S]*?)<\/script>/gi,
                /<iframe\b[^>]*src=["']https?:\/\/[^"']*(adserver|adtech|doubleclick|ads)[^"']*["'][^>]*><\/iframe>/gi
            ];

            adPatterns.forEach(pattern => {
                modifiedHtml = modifiedHtml.replace(pattern, '');
            });

            return res.send(modifiedHtml);
        }
        
        return res.status(500).send('Error: Invalid response layout.');

    } catch (error) {
        console.error(error.message);
        return res.status(500).send(`Engine Error: ${error.message}`);
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`http://localhost:${PORT}`);
    });
}

module.exports = app;
