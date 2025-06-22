<<<<<<< HEAD
# Monitor de Spread

Monitor simples que verifica os preços de criptomoedas nas exchanges Gate.io e MEXC e calcula o spread entre elas.

## Funcionalidades

- Monitora preços de BTC, ETH, SOL, BNB e XRP contra USDT
- Calcula o spread entre as exchanges
- Salva os dados em um banco PostgreSQL
- Limpa automaticamente dados mais antigos que 7 dias
- Roda a cada 5 minutos

## Requisitos

- Node.js 18.17.0 ou superior
- PostgreSQL
- Variáveis de ambiente:
  - DATABASE_URL: URL de conexão com o banco PostgreSQL

## Instalação

```bash
npm install
```

## Execução

```bash
npm start
```
=======
# Robo de Arbitragem

Este é um projeto de um robô de arbitragem de criptomoedas que utiliza Next.js para o frontend e um tracker de spreads em TypeScript.

## Pré-requisitos

- Node.js (v18 ou superior)
- npm ou pnpm

## Configuração do Ambiente

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/seu-repositorio.git
    cd seu-repositorio
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
    - Crie um banco de dados PostgreSQL.
    - Crie um arquivo `.env` na raiz do projeto.
    - Adicione a variável `DATABASE_URL` ao arquivo `.env`. Para o deploy no Render, use a seguinte URL:
    
    ```
    DATABASE_URL="postgresql://arbitragem_render_user:GQRuYklWCXbn9at8mgq1M6ijXpotCpHR@dpg-d148lss9c44c73d1n2qg-a/arbitragem_render"
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
- O servidor de desenvolvimento do Next.js em `http://localhost:3000`.
- O robô de monitoramento de spreads (`spread-tracker`).

## Scripts Disponíveis

- `npm run dev`: Inicia o ambiente de desenvolvimento completo.
- `npm run build`: Compila o projeto Next.js e o robô de spreads para produção.
- `npm run start`: Inicia o projeto em modo de produção.
- `npm run dev:tracker`: Inicia apenas o robô de monitoramento em modo de desenvolvimento com hot-reload.
- `npm run start:tracker`: Inicia apenas o robô de monitoramento em modo de produção.

## Deploy no Render

Este projeto está configurado para deploy contínuo no Render a partir do GitHub.

### Configuração no Render

1.  **Crie um novo "Background Worker"** no Render e conecte ao seu repositório do GitHub.
2.  **Configurações do Serviço:**
    - **Build Command:** `npm run build`
    - **Start Command:** `npm run start:tracker`
3.  **Variáveis de Ambiente:**
    - Adicione a variável `DATABASE_URL` com a string de conexão do seu banco de dados PostgreSQL do Render:
    
    ```
    postgresql://arbitragem_render_user:GQRuYklWCXbn9at8mgq1M6ijXpotCpHR@dpg-d148lss9c44c73d1n2qg-a/arbitragem_render
    ```

O Render irá automaticamente fazer o deploy de novas versões a cada push para a branch principal do seu repositório.
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
