const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Servir os arquivos estáticos da pasta public (onde fica o seu index.html)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    let targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Error: URL parameter is missing.');
    }

    // Normalização de protocolo (Garante que tenha https://)
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        // Requisição HTTP avançada para buscar o site alvo
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            },
            responseType: 'text',
            timeout: 15000, // Timeout de 15s para evitar que o Vercel trave
            validateStatus: (status) => status < 500, // Permite processar redirects (302) sem quebrar o axios
            maxRedirects: 5
        });

        // Remove cabeçalhos de segurança originais do site que impediriam o funcionamento dentro do iframe
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Content-Type-Options');
        
        // Define cabeçalhos de resposta limpos e abertos
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        // Captura a origem do site para reconstruir caminhos relativos (Imagens, CSS, scripts locais)
        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            // 1. Injeta a tag <base> para corrigir caminhos quebrando
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', baseTag);
            } else {
                modifiedHtml = baseTag + modifiedHtml;
            }

            // 2. SISTEMA DE BLOQUEIO DE ANÚNCIOS (Ad-Blocker Engine)
            // Expressões regulares que detectam e removem redes de anúncios conhecidas e scripts de popups
            const adPatterns = [
                /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice|adbrite|exponential|popads|propellerads|juicyads|exoclick|onclickads)[^"']*["'][^>]*><\/script>/gi,
                /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi, // Blocos Google AdSense
                /<script\b[^>]*>([\s\S]*?)(adsbygoogle|window\.adsbygoogle|amazon-adsystem|popunder)([\s\S]*?)<\/script>/gi, // Inline scripts de anúncios
                /<iframe\b[^>]*src=["']https?:\/\/[^"']*(adserver|adtech|doubleclick|ads)[^"']*["'][^>]*><\/iframe>/gi // IFrames de anúncios terceiros
            ];

            // Executa a limpa varrendo o HTML bruto recebido do servidor
            adPatterns.forEach(pattern => {
                modifiedHtml = modifiedHtml.replace(pattern, '');
            });

            // Envia o código limpo e modificado de volta para o cliente carregar
            return res.send(modifiedHtml);
        } else {
            return res.status(500).send('Error: Target responded with an unrenderable data format.');
        }

    } catch (error) {
        // Envia o log detalhado para o painel de Logs do Vercel para debug rápido
        console.error(`[Proxy Exception]: ${error.message}`);
        return res.status(500).send(`Engine Error: Unable to resolve target node. Details: ${error.message}`);
    }
});

// Listener padrão ativado APENAS quando você rodar o projeto localmente (npm start / node server.js)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`[Proxy Active] Local access: http://localhost:${PORT}`);
    });
}

// Exporta a instância para o ciclo de vida Serverless da Vercel
module.exports = app;
            
