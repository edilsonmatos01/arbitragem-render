import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';

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

interface WebSocketMessage {
  time?: number;
  channel?: string;
  event?: string;
  method?: string;
  params?: string[];
  param?: {
    symbol: string;
  };
  payload?: string[];
}

// Configurações
const MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutos
const RECONNECT_INTERVAL = 5000; // 5 segundos
let isWorkerRunning = false;
let isShuttingDown = false;
let prisma: PrismaClient | null = null;

// Configurações WebSocket
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
const MEXC_WS_URL = 'wss://wbs.mexc.com/ws';
const GATEIO_FUTURES_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
const MEXC_FUTURES_WS_URL = 'wss://futures.mexc.com/ws';

// Função para criar conexão WebSocket
function createWebSocket(url: string, name: string): WebSocket {
  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`[${name}] Conexão WebSocket estabelecida`);
  });

  ws.on('error', (error: Error) => {
    console.error(`[${name}] Erro WebSocket:`, error);
  });

  ws.on('close', () => {
    console.log(`[${name}] Conexão WebSocket fechada`);
    if (!isShuttingDown) {
      console.log(`[${name}] Tentando reconectar em ${RECONNECT_INTERVAL/1000} segundos...`);
      setTimeout(() => {
        try {
          const newWs = createWebSocket(url, name);
          // Substitui o WebSocket antigo pelo novo
          if (name === 'Gate.io Spot') gateioWs = newWs;
          else if (name === 'MEXC Spot') mexcWs = newWs;
          else if (name === 'Gate.io Futures') gateioFuturesWs = newWs;
          else if (name === 'MEXC Futures') mexcFuturesWs = newWs;
        } catch (error) {
          console.error(`[${name}] Erro ao reconectar:`, error);
        }
      }, RECONNECT_INTERVAL);
    }
  });

  return ws;
}

// Inicializa as conexões WebSocket
let gateioWs = createWebSocket(GATEIO_WS_URL, 'Gate.io Spot');
let mexcWs = createWebSocket(MEXC_WS_URL, 'MEXC Spot');
let gateioFuturesWs = createWebSocket(GATEIO_FUTURES_WS_URL, 'Gate.io Futures');
let mexcFuturesWs = createWebSocket(MEXC_FUTURES_WS_URL, 'MEXC Futures');

// Função para inicializar o Prisma com retry
async function initializePrisma(retryCount = 0, maxRetries = 5): Promise<void> {
  try {
    if (!prisma) {
      prisma = new PrismaClient();
      await prisma.$connect();
      console.log('[Worker] Conexão com o banco de dados estabelecida');
    }
  } catch (error) {
    console.error('[Worker] Erro ao conectar com o banco de dados:', error);
    if (retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`[Worker] Tentando reconectar ao banco de dados em ${delay/1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      await initializePrisma(retryCount + 1, maxRetries);
    } else {
      throw new Error('Não foi possível conectar ao banco de dados após várias tentativas');
    }
  }
}

// Função para obter pares negociáveis
async function getTradablePairs(): Promise<TradableSymbol[]> {
  try {
    if (!prisma) {
      await initializePrisma();
    }
    return await prisma!.$queryRaw<TradableSymbol[]>`
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
async function monitorAndStore(): Promise<void> {
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
          const message: WebSocketMessage = {
            time: Date.now(),
            channel: "spot.tickers",
            event: "subscribe",
            payload: [symbol.gateioSymbol]
          };
          gateioWs.send(JSON.stringify(message));
        }

        if (mexcWs.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            method: "SUBSCRIPTION",
            params: [`spot/ticker.${symbol.mexcSymbol}`]
          };
          mexcWs.send(JSON.stringify(message));
        }

        if (gateioFuturesWs.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            time: Date.now(),
            channel: "futures.tickers",
            event: "subscribe",
            payload: [symbol.gateioFuturesSymbol]
          };
          gateioFuturesWs.send(JSON.stringify(message));
        }

        if (mexcFuturesWs.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            method: "sub.contract.ticker",
            param: {
              symbol: symbol.mexcFuturesSymbol
            }
          };
          mexcFuturesWs.send(JSON.stringify(message));
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
function processWebSocketMessage(exchange: string, data: WebSocket.Data): void {
  try {
    console.log(`[${exchange}] Dados recebidos:`, data);
    // Aqui você implementa a lógica específica para processar os dados de cada exchange
  } catch (error) {
    console.error(`[${exchange}] Erro ao processar mensagem:`, error);
  }
}

// Configura handlers de mensagem
gateioWs.on('message', (data: WebSocket.Data) => processWebSocketMessage('Gate.io Spot', data));
mexcWs.on('message', (data: WebSocket.Data) => processWebSocketMessage('MEXC Spot', data));
gateioFuturesWs.on('message', (data: WebSocket.Data) => processWebSocketMessage('Gate.io Futures', data));
mexcFuturesWs.on('message', (data: WebSocket.Data) => processWebSocketMessage('MEXC Futures', data));

// Função principal que mantém o worker rodando
async function startWorker(): Promise<void> {
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
  
  if (prisma) {
    await prisma.$disconnect();
  }
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
  
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

// Inicia o worker
startWorker().catch(error => {
  console.error('[Worker] Erro fatal:', error);
  process.exit(1);
}); 