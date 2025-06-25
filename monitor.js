const fetch = require('node-fetch');
const { Pool } = require('pg');
const WebSocket = require('ws');
require('dotenv').config();

let wss;
const clients = new Set();

// Função para broadcast das mensagens
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Função para iniciar o monitor
function startMonitor(webSocketServer) {
  wss = webSocketServer;

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Cliente WebSocket conectado. Total:', clients.size);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Cliente WebSocket desconectado. Total:', clients.size);
    });
  });

  // Inicia o monitoramento
  console.log('Monitor iniciado. Executando a cada 5 minutos...');
  setInterval(monitorSpread, 5 * 60 * 1000); // 5 minutos
  monitorSpread();
}

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Símbolos para monitorar
const SYMBOLS = {
  'BTC/USDT': {
    gateio: 'BTC_USDT',
    mexc: 'BTC_USDT'
  },
  'ETH/USDT': {
    gateio: 'ETH_USDT',
    mexc: 'ETH_USDT'
  },
  'SOL/USDT': {
    gateio: 'SOL_USDT',
    mexc: 'SOL_USDT'
  },
  'BNB/USDT': {
    gateio: 'BNB_USDT',
    mexc: 'BNB_USDT'
  },
  'XRP/USDT': {
    gateio: 'XRP_USDT',
    mexc: 'XRP_USDT'
  }
};

// Função para calcular o spread
function calculateSpread(price1, price2) {
  return ((price2 - price1) / price1) * 100;
}

// Função para obter preço do Gate.io
async function getGateioPrice(symbol) {
  try {
    const response = await fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol}`);
    const data = await response.json();
    const ticker = data[0];
    
    if (!ticker) {
      throw new Error(`No ticker data for ${symbol}`);
    }

    const buy = Number(ticker.highest_bid);
    const sell = Number(ticker.lowest_ask);
    const price = (buy + sell) / 2;

    // Envia os dados via broadcast
    broadcast({
      type: 'price-update',
      exchange: 'GATEIO',
      symbol,
      bestBid: buy,
      bestAsk: sell,
      timestamp: Date.now()
    });

    return price;
  } catch (error) {
    console.error(`Error fetching Gate.io price for ${symbol}:`, error);
    return 0;
  }
}

// Função para obter preço do MEXC Futures
async function getMexcPrice(symbol) {
  try {
    const response = await fetch(`https://contract.mexc.com/api/v1/contract/ticker?symbol=${symbol}`);
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(`Invalid response for ${symbol}: ${JSON.stringify(data)}`);
    }

    const ticker = data.data;
    const buy = Number(ticker.bid);
    const sell = Number(ticker.ask);
    const price = (buy + sell) / 2;

    // Envia os dados via broadcast
    broadcast({
      type: 'price-update',
      exchange: 'MEXC_FUTURES',
      symbol,
      bestBid: buy,
      bestAsk: sell,
      timestamp: Date.now()
    });

    return price;
  } catch (error) {
    console.error(`Error fetching MEXC Futures price for ${symbol}:`, error);
    return 0;
  }
}

// Função para salvar spread no banco
async function saveSpread(data) {
  const query = `
    INSERT INTO "Spread" (symbol, "gateioPrice", "mexcPrice", "spreadPercentage", timestamp)
    VALUES ($1, $2, $3, $4, $5)
  `;
  
  const values = [
    data.symbol,
    data.gateioPrice,
    data.mexcPrice,
    data.spreadPercentage,
    data.timestamp
  ];

  try {
    await pool.query(query, values);
    console.log(`Spread saved successfully for ${data.symbol}`);
  } catch (error) {
    console.error('Error saving spread:', error);
  }
}

// Função para limpar spreads antigos
async function cleanOldSpreads(days) {
  const query = `
    DELETE FROM "Spread"
    WHERE timestamp < NOW() - INTERVAL '${days} days'
  `;
  
  try {
    await pool.query(query);
    console.log(`Cleaned spreads older than ${days} days`);
  } catch (error) {
    console.error('Error cleaning old spreads:', error);
  }
}

// Função principal de monitoramento
async function monitorSpread() {
  try {
    console.log('Starting spread monitoring...');
    for (const [baseSymbol, exchangeSymbols] of Object.entries(SYMBOLS)) {
      try {
        console.log(`Fetching prices for ${baseSymbol}...`);
        console.log(`Gate.io symbol: ${exchangeSymbols.gateio}`);
        console.log(`MEXC symbol: ${exchangeSymbols.mexc}`);

        const [gateioPrice, mexcPrice] = await Promise.all([
          getGateioPrice(exchangeSymbols.gateio),
          getMexcPrice(exchangeSymbols.mexc)
        ]);

        console.log(`Prices for ${baseSymbol}:`, {
          gateio: gateioPrice,
          mexc: mexcPrice
        });

        if (!gateioPrice || !mexcPrice) {
          console.log(`Preço não disponível para ${baseSymbol}`);
          continue;
        }

        const spreadPercentage = calculateSpread(gateioPrice, mexcPrice);
        console.log(`Spread for ${baseSymbol}: ${spreadPercentage}%`);

        await saveSpread({
          symbol: baseSymbol,
          gateioPrice,
          mexcPrice,
          spreadPercentage,
          timestamp: new Date()
        });

        // Envia o spread via broadcast
        broadcast({
          type: 'spread-update',
          symbol: baseSymbol,
          gateioPrice,
          mexcPrice,
          spreadPercentage,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error(`Error processing ${baseSymbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in monitorSpread:', error);
  }
}

module.exports = {
  startMonitor,
  monitorSpread,
  cleanOldSpreads
}; 