
# Excalibur Store - Roblox Asset Hub

Marketplace descentralizado de assets para Roblox (.rbxm, .rbxl).

## Arquitetura
- **Storage**: GitHub (via API REST).
- **Metadata**: JSON persistido em cada pasta de asset no repositório.
- **AI**: Gemini para geração de tags e busca semântica.
- **Auth**: Google OAuth 2.0.

## Estrutura do Repositório
`Marketplace/Assets/{ID}/`
- `metadata.json`: Metadados, likes, downloads e comentários.
- `asset_bin`: Arquivo binário ofuscado.
- `thumb_bin`: Thumbnail oficial.
- `video_bin`: Vídeo de showcase.
