
# Excalibur Store - Neon DB Setup

Este projeto usa o **Neon Database (PostgreSQL)** para gerenciar metadados de assets, usuários e comentários em tempo real.

## Como configurar o Neon SQL Editor

1. Acesse o console da Neon: [console.neon.tech](https://console.neon.tech)
2. Vá até a aba **SQL Editor**.
3. Copie e execute o código abaixo para criar a estrutura necessária:

```sql
-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT,
    avatar TEXT,
    bio TEXT,
    timestamp BIGINT
);

-- Tabela de Assets (Roblox Files)
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    author_name TEXT,
    author_avatar TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    thumbnail_url TEXT,
    file_data TEXT,
    file_type TEXT,
    download_count INTEGER DEFAULT 0,
    timestamp BIGINT
);

-- Tabela de Comentários
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    text TEXT,
    timestamp BIGINT
);
```

## Por que Neon?
- **Escalabilidade**: Os dados aparecem para todos os usuários instantaneamente.
- **Segurança**: As permissões de acesso aos arquivos continuam com o Puter, mas a lógica de busca e feed é processada no SQL.
- **Relacionamentos**: Comentários e downloads são vinculados diretamente aos arquivos.

**Site:** https://excaliburstore.vercel.app/
