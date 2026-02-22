# Especificações Técnicas - Excalibur Store

Este documento detalha as configurações de infraestrutura e integração do Excalibur Store.

## 🔑 Configurações do GitHub (Persistência)

O aplicativo utiliza o GitHub como um backend de dados (Database-as-a-Repo). As seguintes constantes definem a localização e o acesso aos dados:

- **Token de Acesso**: `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`
- **Proprietário (Owner)**: `FISTOFDARKNESS`
- **Repositório**: `excaliburstore`
- **Branch**: `main`

### Estrutura de Diretórios no Repositório

1. **Assets**: `Marketplace/Assets/`
   - Cada subpasta é um `AssetID`.
   - Contém: `metadata.json`, `file.rbxm`, `thumbnail.png`, `preview.mp4`.
2. **Usuários**: `Marketplace/Users/`
   - Cada subpasta é um `UserID` (Google Sub ID).
   - Contém: `profile.json` (Dados de perfil, seguidores, seguindo, status de banimento).
3. **Registro de Nomes**: `Marketplace/Registry/usernames.json`
   - Mapeamento global de `Username -> UserID` para evitar duplicatas e permitir buscas por nome.

## 🤖 Integração com Inteligência Artificial (Gemini)

O sistema utiliza o modelo **Gemini 3 Flash** para processamento de linguagem natural:

- **Geração de Keywords**: Analisa metadados de upload para criar tags otimizadas.
- **Busca Semântica**: Expande queries simples (ex: "carro") para termos técnicos ("A-Chassis", "Vehicle", "Drive System").

## 🔐 Autenticação e Identidade

- **Provedor**: Google Identity Services.
- **Client ID**: `308189275559-463hh72v4qto39ike23emrtc4r51galf.apps.googleusercontent.com`
- **Fluxo**: O login é processado no frontend, e o perfil é sincronizado com o repositório GitHub no primeiro acesso.

## 🚀 Fluxo de Dados (Uplink)

1. O usuário seleciona os arquivos (Binário, Imagem, Vídeo).
2. O Gemini gera as tags baseadas no título/descrição.
3. Os arquivos são convertidos para Base64.
4. O sistema envia 4 requisições `PUT` sequenciais para a API do GitHub:
   - Upload da Thumbnail.
   - Upload do Vídeo.
   - Upload do Binário Roblox.
   - Upload do `metadata.json` final.
5. O registro global é atualizado.

---
*Documentação técnica gerada para o administrador do sistema.*
