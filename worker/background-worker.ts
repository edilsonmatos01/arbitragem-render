import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';
import { calculateSpread } from '../src/utils';

// Interfaces
interface MarketPrice {
  symbol: string;
  bestAsk: number;
  bestBid: number;
}

interface TradableSymbol {
  baseSymbol: string;
  gateioSymbol: string;
  mexcSymbol: string;
  gateioFuturesSymbol: string;
  mexcFuturesSymbol: string;
}

// Inicializa o cliente Prisma
const prisma = new PrismaClient();

// Configurações
const MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutos
let isWorkerRunning = false;
let isShuttingDown = false;

// Configurações WebSocket
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
const MEXC_WS_URL = 'wss://wbs.mexc.com/ws';
const GATEIO_FUTURES_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/ws';

// Função para criar conexão WebSocket
function createWebSocket(url: string, name: string): WebSocket {
  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`[${name}] Conexão WebSocket estabelecida`);
  });

  ws.on('error', (error) => {
    console.error(`[${name}] Erro WebSocket:`, error);
  });

  ws.on('close', () => {
    console.log(`[${name}] Conexão WebSocket fechada`);
    if (!isShuttingDown) {
      console.log(`[${name}] Tentando reconectar em 5 segundos...`);
      setTimeout(() => createWebSocket(url, name), 5000);
    }
  });

  return ws;
}

// Inicializa as conexões WebSocket
const gateioWs = createWebSocket(GATEIO_WS_URL, 'Gate.io Spot');
const mexcWs = createWebSocket(MEXC_WS_URL, 'MEXC Spot');
const gateioFuturesWs = createWebSocket(GATEIO_FUTURES_WS_URL, 'Gate.io Futures');
const mexcFuturesWs = createWebSocket(MEXC_FUTURES_WS_URL, 'MEXC Futures');

// Função para obter pares negociáveis
async function getTradablePairs() {
  try {
    return await prisma.$queryRaw<TradableSymbol[]>`
      SELECT "baseSymbol", "gateioSymbol", "mexcSymbol", "gateioFuturesSymbol", "mexcFuturesSymbol"
      FROM "TradableSymbol"
      WHERE "isActive" = true
    `;
  } catch (error) {
    console.error('[Worker] Erro ao obter pares negociáveis:', error);
    return [];
  }
}

// Função principal de monitoramento
async function monitorAndStore() {
  if (isWorkerRunning) {
    console.log('[Worker] Monitoramento já está em execução');
    return;
  }

  try {
    isWorkerRunning = true;
    console.log(`[Worker ${new Date().toISOString()}] Iniciando monitoramento...`);
    
    const symbols = await getTradablePairs();
    
    for (const symbol of symbols) {
      if (isShuttingDown) break;

      try {
        // Subscreve aos canais de preço para cada símbolo
        if (gateioWs.readyState === WebSocket.OPEN) {
          gateioWs.send(JSON.stringify({
            "time": Date.now(),
            "channel": "spot.tickers",
            "event": "subscribe",
            "payload": [symbol.gateioSymbol]
          }));
        }

        if (mexcWs.readyState === WebSocket.OPEN) {
          mexcWs.send(JSON.stringify({
            "method": "SUBSCRIPTION",
            "params": [`spot/ticker.${symbol.mexcSymbol}`]
          }));
        }

        if (gateioFuturesWs.readyState === WebSocket.OPEN) {
          gateioFuturesWs.send(JSON.stringify({
            "time": Date.now(),
            "channel": "futures.tickers",
            "event": "subscribe",
            "payload": [symbol.gateioFuturesSymbol]
          }));
        }

        if (mexcFuturesWs.readyState === WebSocket.OPEN) {
          mexcFuturesWs.send(JSON.stringify({
            "method": "sub.contract.ticker",
            "param": {
              "symbol": symbol.mexcFuturesSymbol
            }
          }));
        }

        console.log(`[Worker] Subscrito aos canais para ${symbol.baseSymbol}`);
      } catch (symbolError) {
        console.error(`[Worker] Erro ao processar ${symbol.baseSymbol}:`, symbolError);
      }
    }
  } catch (error) {
    console.error('[Worker] Erro no monitoramento:', error);
  } finally {
    isWorkerRunning = false;
  }
}

// Função para processar mensagens WebSocket
function processWebSocketMessage(exchange: string, data: any) {
  try {
    console.log(`[${exchange}] Dados recebidos:`, data);
    // Aqui você implementa a lógica específica para processar os dados de cada exchange
  } catch (error) {
    console.error(`[${exchange}] Erro ao processar mensagem:`, error);
  }
}

// Configura handlers de mensagem
gateioWs.on('message', (data) => processWebSocketMessage('Gate.io Spot', data));
mexcWs.on('message', (data) => processWebSocketMessage('MEXC Spot', data));
gateioFuturesWs.on('message', (data) => processWebSocketMessage('Gate.io Futures', data));
mexcFuturesWs.on('message', (data) => processWebSocketMessage('MEXC Futures', data));

// Função principal que mantém o worker rodando
async function startWorker() {
  console.log('[Worker] Iniciando worker em segundo plano...');
  
  while (!isShuttingDown) {
    await monitorAndStore();
    await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL));
  }
}

// Tratamento de encerramento gracioso
process.on('SIGTERM', async () => {
  console.log('[Worker] Recebido sinal SIGTERM, encerrando graciosamente...');
  isShuttingDown = true;
  
  // Fecha as conexões WebSocket
  gateioWs.close();
  mexcWs.close();
  gateioFuturesWs.close();
  mexcFuturesWs.close();
  
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Recebido sinal SIGINT, encerrando graciosamente...');
  isShuttingDown = true;
  
  // Fecha as conexões WebSocket
  gateioWs.close();
  mexcWs.close();
  gateioFuturesWs.close();
  mexcFuturesWs.close();
  
  await prisma.$disconnect();
  process.exit(0);
});

// Inicia o worker
startWorker().catch(error => {
  console.error('[Worker] Erro fatal:', error);
  process.exit(1);
}); 