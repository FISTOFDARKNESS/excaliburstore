const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    let targetUrl = req.query.url;
    let country = req.query.country || 'US'; // Padrão é Estados Unidos se não enviar nenhum
    
    if (!targetUrl) {
        return res.status(400).send('Error: URL parameter is missing.');
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    // Configuração do Proxy de saída (Exemplo usando formato padrão do mercado)
    // Muitos provedores permitem mudar o país mudando o sufixo do nome de usuário (ex: user-country-BR)
    const proxyConfig = {
        host: 'p.webshare.io', // Endereço do provedor de proxy
        port: 80,
        auth: {
            username: `jnetnpdp${country}`, // O país muda dinamicamente aqui
            password: '7zev7xs7ogzr'
        }
    };

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            responseType: 'text',
            timeout: 20000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5,
            
            // A MÁGICA ACONTECE AQUI: O Axios desvia o tráfego pelo túnel do país selecionado
            proxy: proxyConfig 
        });

        // Limpeza de headers para rodar no Iframe
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });

        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            modifiedHtml = modifiedHtml.includes('<head>') ? modifiedHtml.replace('<head>', baseTag) : baseTag + modifiedHtml;
            
            // Ad-blocker integrado da versão anterior
            const adPatterns = [
                /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice|popads)[^"']*["'][^>]*><\/script>/gi,
                /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi
            ];
            adPatterns.forEach(pattern => modifiedHtml = modifiedHtml.replace(pattern, ''));

            return res.send(modifiedHtml);
        }
        
        return res.status(500).send('Invalid format.');

    } catch (error) {
        console.error(`[Tunnel Exception]: ${error.message}`);
        return res.status(500).send(`VPN Tunnel Error: ${error.message}`);
    }
});

module.exports = app;
            
