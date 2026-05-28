const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Servir os arquivos estáticos da interface front-end (index.html)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
    let targetUrl = req.query.url;
    let country = req.query.country || 'US'; // Define Estados Unidos como padrão
    
    if (!targetUrl) {
        return res.status(400).send('Error: URL parameter is missing.');
    }

    // Normalização estrita de protocolo (Garante o prefixo https://)
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
    }

    // Ajuste Seguro das Credenciais da Webshare usando Variáveis de Ambiente
    // Se você não configurou as variáveis na Vercel ainda, o código usa o seu token como fallback automático
    const webshareToken = process.env.WEBSHARE_TOKEN || 'fpefy4h82b2i8231ja8j99mxwbnoykwdjegustf4';
    const websharePassword = process.env.WEBSHARE_PASS || ''; // Insira sua senha padrão da Webshare aqui se necessário

    const proxyConfig = {
        host: 'p.webshare.io',
        port: 80,
        auth: {
            username: `${webshareToken}-country-${country}`, 
            password: websharePassword
        }
    };

    try {
        // Dispara a requisição encapsulada através do nó do país escolhido
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            },
            responseType: 'text',
            timeout: 20000, // Janela de 20 segundos para conexões lentas de proxies residenciais
            validateStatus: (status) => status < 500, // Permite que redirects e códigos 404 passem sem crashar
            maxRedirects: 5,
            proxy: proxyConfig 
        });

        // Elimina travas de cabeçalhos de segurança originais que bloqueiam exibição em iframes
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Content-Type-Options');
        
        // Define cabeçalhos universais de renderização limpa
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        // Reconstrói caminhos relativos de mídias e assets usando a tag <base>
        const parsedUrl = new URL(targetUrl);
        const baseTag = `<head><base href="${parsedUrl.origin}/">`;
        let modifiedHtml = response.data;
        
        if (typeof modifiedHtml === 'string') {
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', baseTag);
            } else {
                modifiedHtml = baseTag + modifiedHtml;
            }
            
            // SISTEMA DE BLOQUEIO DE ANÚNCIOS AVANÇADO (Ad-Blocker Engine)
            const adPatterns = [
                /<script\b[^>]*src=["']https?:\/\/[^"']*(googlesyndication|google-analytics|doubleclick|adservice|adbrite|exponential|popads|propellerads|juicyads|exoclick|onclickads)[^"']*["'][^>]*><\/script>/gi,
                /<ins\b[^>]*class=["']adsbygoogle["'][^>]*>([\s\S]*?)<\/ins>/gi, // Blocos Google AdSense
                /<script\b[^>]*>([\s\S]*?)(adsbygoogle|window\.adsbygoogle|amazon-adsystem|popunder)([\s\S]*?)<\/script>/gi, // Scripts inline maliciosos/banners
                /<iframe\b[^>]*src=["']https?:\/\/[^"']*(adserver|adtech|doubleclick|ads)[^"']*["'][^>]*><\/iframe>/gi // IFrames ocultos de ads
            ];

            // Varre o HTML injetando comentários vazios no lugar das tags de anúncios
            adPatterns.forEach(pattern => {
                modifiedHtml = modifiedHtml.replace(pattern, '');
            });

            return res.send(modifiedHtml);
        }
        
        return res.status(500).send('Error: Target responded with an invalid layout string.');

    } catch (error) {
        // Envia relatórios detalhados para o painel de logs do Vercel Runtime
        console.error(`[Tunnel Exception]: ${error.message}`);
        return res.status(500).send(`VPN Tunnel Error: Unable to resolve target node via Webshare [${country}]. Details: ${error.message}`);
    }
});

// Listener local ativo apenas em ambiente de desenvolvimento (npm start)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`[Proxy Active] Servidor local em execução: http://localhost:${PORT}`);
    });
}

// Exporta o módulo adaptado para as Serverless Functions da Vercel
module.exports = app;
        
