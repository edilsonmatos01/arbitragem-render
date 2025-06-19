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
