const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // Serves the front-end

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required.');
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'text'
        });

        // Strip Anti-Iframe Headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        res.set({
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*'
        });

        // Advanced Base Injector to fix relative links, CSS, and scripts
        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        let modifiedHtml = response.data.replace('<head>', baseTag);

        res.send(modifiedHtml);

    } catch (error) {
        res.status(500).send(`Proxy Error: Unable to fetch the target resource. Details: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`[Proxy Server Active] Running on http://localhost:${PORT}`);
});
        
