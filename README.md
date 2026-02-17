
# 🗡️ EXCALIBUR STORE - ROBLOX ASSET HUB

O **Excalibur Store** é um marketplace premium e descentralizado focado na distribuição de arquivos de alta performance para Roblox (`.rbxm`, `.rbxl`, `.rbxmx`). O sistema foi projetado para operar sem um backend tradicional, utilizando a infraestrutura do GitHub como banco de dados binário e metadados.

---

## 🏗️ ARQUITETURA "SERVERLESS" (GITHUB OS)

Diferente de sites comuns que usam SQL, o Excalibur utiliza a **GitHub REST API v3** como motor de persistência. Cada ação no site (upload, like, comentário) resulta em um commit atômico no repositório.

### 📁 Estrutura do Repositório (Database)
As informações são salvas seguindo esta hierarquia rigorosa:

```text
Marketplace/
├── Registry/
│   └── usernames.json      # Índice global de unicidade de nomes (evita fakes)
├── Users/
│   └── {GOOGLE_ID}/
│       └── profile.json    # Stats, seguidores, cargo (Admin/Verified) e ban status
└── Assets/
    └── {ASSET_ID}/
        ├── metadata.json   # Tags IA, Likes, Comentários, Downloads e Reports
        ├── file.rbxm       # O binário original do Roblox
        ├── thumbnail.png   # Capa do asset
        └── preview.mp4     # Vídeo showcase (autoplay no hover)
```

---

## 💎 FUNCIONALIDADES EM DETALHES

### 1. Sistema de Identidade Universal
*   **Auth**: Integração total com Google OAuth 2.0.
*   **Username Registry**: Ao logar pela primeira vez, o sistema reserva seu nome no `usernames.json`. Se o nome já existir, ele gera um sufixo numérico (ex: `Player#1234`).
*   **Social**: Sistema de Follow/Unfollow persistido nos perfis de ambos os agentes.

### 2. Protocolo de Upload & IA
*   **Otimização Gemini**: Ao enviar um arquivo, a IA (Gemini 3 Flash) analisa o título e a descrição para gerar 10 palavras-chave semânticas.
*   **Validação de Binários**: Aceita estritamente extensões oficiais do Roblox.
*   **Showcase Dinâmico**: Suporte obrigatório a vídeo para visualização prévia sem precisar abrir o Roblox Studio.

### 3. Busca Semântica Avançada
*   O campo de busca não olha apenas o título. Ele consulta as palavras-chave geradas pela IA e utiliza expansão de termos (ex: buscar "carro" também encontra "veículo" ou "chassis").

### 4. Moderação e Segurança (Command Center)
*   **Reports**: Assets denunciados ficam em observação. Acima de 5 reports, o card torna-se cinza e opaco.
*   **Admin Panel (CTRL+B)**: Atalho oculto para administradores (kaioadrik08@gmail.com). Permite:
    *   Banir/Desbanir usuários instantaneamente.
    *   Verificar criadores (Selo Azul).
    *   Expurgar (Delete) arquivos diretamente do repositório GitHub.
    *   Monitorar denúncias em tempo real.

---

## 🔗 LINKS E RECURSOS

*   **Repositório Base**: `https://github.com/FISTOFDARKNESS/excaliburstore`
*   **CDN de Assets**: Os arquivos são servidos via `raw.githubusercontent.com`.
*   **Tecnologias**: 
    *   **Frontend**: React 19 + TypeScript.
    *   **Estilização**: Tailwind CSS (Design System Dark Premium).
    *   **Inteligência**: Google GenAI (Gemini API).
    *   **Storage**: Puter.js + GitHub API.

---

## 🛰️ PROTOCOLO DE SINCRONIZAÇÃO
Toda alteração de estado no site (como dar um Like) segue este fluxo:
1.  Busca o `SHA` do arquivo atual no GitHub.
2.  Decodifica o Base64 do arquivo JSON.
3.  Modifica o objeto localmente.
4.  Recodifica e envia um `PUT` request com o novo conteúdo, atualizando a "database".

---
*Documento Gerado pelo Sistema Excalibur OS - Protocolo de Transmissão Ativo.*
