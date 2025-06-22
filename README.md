# Robo de Arbitragem

Monitor e robô de arbitragem que verifica os preços de criptomoedas nas exchanges Gate.io e MEXC, calcula o spread entre elas e fornece uma interface web para visualização e acompanhamento.

## Funcionalidades

- Monitora preços de criptomoedas contra USDT em tempo real
- Calcula o spread entre as exchanges
- Interface web moderna com Next.js para visualização dos dados
- Salva os dados em um banco PostgreSQL
- Limpa automaticamente dados mais antigos que 24 horas
- Sistema de websockets para atualizações em tempo real
- Suporte para múltiplas exchanges (Gate.io e MEXC)

## Pré-requisitos

- Node.js (v18 ou superior)
- npm ou pnpm
- PostgreSQL

## Configuração do Ambiente

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/edilsonmatos01/arbitragem-render.git
    cd arbitragem-render
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```
    ou
    ```bash
    pnpm install
    ```

3.  **Configuração do Banco de Dados:**
    - Crie um banco de dados PostgreSQL
    - Crie um arquivo `.env` na raiz do projeto
    - Adicione as seguintes variáveis de ambiente:
    
    ```
    DATABASE_URL="sua_url_do_postgresql"
    NEXT_PUBLIC_WEBSOCKET_URL="ws://localhost:3001"
    MEXC_API_KEY="sua_chave_api_mexc"
    MEXC_SECRET="seu_secret_mexc"
    GATE_API_KEY="sua_chave_api_gate"
    GATE_SECRET="seu_secret_gate"
    ```

4.  **Execute as migrações do Prisma:**
    ```bash
    npx prisma migrate dev
    ```

## Executando Localmente

Para iniciar o ambiente de desenvolvimento local, que inclui o frontend Next.js e o robô de monitoramento de spreads, execute:

```bash
npm run dev
```

Isso iniciará:
- O servidor de desenvolvimento do Next.js em `http://localhost:3000`
- O robô de monitoramento de spreads (`spread-tracker`)
- O servidor de websockets para atualizações em tempo real

## Scripts Disponíveis

- `npm run dev`: Inicia o ambiente de desenvolvimento completo
- `npm run build`: Compila o projeto Next.js e o robô de spreads para produção
- `npm run start`: Inicia o projeto em modo de produção
- `npm run dev:tracker`: Inicia apenas o robô de monitoramento em modo de desenvolvimento com hot-reload
- `npm run start:tracker`: Inicia apenas o robô de monitoramento em modo de produção
- `npm run prisma:deploy`: Executa as migrações do banco de dados em produção

## Deploy no Render

Este projeto está configurado para deploy contínuo no Render a partir do GitHub.

### Configuração no Render

1.  **Serviço Web (Frontend):**
    - **Build Command:** `npm install && npm install typescript @types/node --save && npm run build && npm run prisma:deploy`
    - **Start Command:** `npm start`
    - **Variáveis de Ambiente:**
      - `NODE_ENV=production`
      - `DATABASE_URL` (do banco PostgreSQL do Render)
      - `NEXT_PUBLIC_WEBSOCKET_URL=wss://robo-de-arbitragem-tracker.onrender.com`
      - Chaves de API das exchanges (MEXC e Gate.io)

2.  **Serviço Web (Tracker):**
    - **Build Command:** `npm install && npm run build:tracker`
    - **Start Command:** `npm run start:tracker`
    - **Variáveis de Ambiente:**
      - `NODE_ENV=production`
      - `DATABASE_URL` (do banco PostgreSQL do Render)
      - Chaves de API das exchanges (MEXC e Gate.io)

O Render irá automaticamente fazer o deploy de novas versões a cada push para a branch principal do seu repositório.
