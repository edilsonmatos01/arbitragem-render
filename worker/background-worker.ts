import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';
import * as https from 'https';

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
const DB_RETRY_INTERVAL = 30000; // 30 segundos
const SUBSCRIPTION_INTERVAL = 60000; // 1 minuto
let isWorkerRunning = false;
let isShuttingDown = false;
let prisma: PrismaClient | null = null;

// Configurações WebSocket
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
const MEXC_WS_URL = 'wss://wbs.mexc.com/ws';
const GATEIO_FUTURES_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/ws';

// Mensagens de subscrição específicas para cada exchange
const SUBSCRIPTION_MESSAGES = {
  'Gate.io Spot': (symbol: string) => ({
    id: Date.now(),
    time: Date.now(),
    channel: "spot.tickers",
    event: "subscribe",
    payload: [symbol]
  }),
  'MEXC Spot': (symbol: string) => ({
    op: "sub",
    symbol: symbol,
    channel: "spot.ticker"
  }),
  'Gate.io Futures': (symbol: string) => ({
    id: Date.now(),
    time: Date.now(),
    channel: "futures.tickers",
    event: "subscribe",
    payload: [symbol]
  }),
  'MEXC Futures': (symbol: string) => ({
    op: "sub",
    symbol: symbol,
    channel: "contract.ticker"
  })
};

// Função para verificar URL antes de conectar WebSocket
async function checkEndpoint(url: string, name: string): Promise<string> {
  if (name === 'MEXC Futures') {
    // Para MEXC Futures, tentamos várias URLs conhecidas
    const possibleUrls = [
      'wss://contract.mexc.com/ws',
      'wss://futures.mexc.com/ws',
      'wss://contract.mexc.com/contract/ws',
      'wss://www.mexc.com/ws/contract'
    ];
    
    for (const testUrl of possibleUrls) {
      try {
        const httpsUrl = testUrl.replace('wss://', 'https://');
        console.log(`[${name}] Testando URL ${testUrl}...`);
        const response = await new Promise((resolve, reject) => {
          const req = https.get(httpsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          req.on('response', (res) => {
            console.log(`[${name}] Resposta de ${testUrl}:`, {
              statusCode: res.statusCode,
              headers: res.headers
            });
            resolve(res);
          });
          req.on('error', reject);
          req.end();
        });
        console.log(`[${name}] URL ${testUrl} disponível!`);
        return testUrl;
      } catch (error: any) {
        console.log(`[${name}] URL ${testUrl} não disponível:`, error.message);
        continue;
      }
    }
    return url;
  }

  return new Promise((resolve) => {
    const httpsUrl = url.replace('wss://', 'https://');
    https.get(httpsUrl, (res) => {
      if (res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 301) {
        const newUrl = `wss://${res.headers.location?.replace('https://', '')}`;
        resolve(newUrl);
      } else {
        resolve(url);
      }
    }).on('error', (err) => {
      console.error(`[${name}] Erro ao verificar endpoint ${url}:`, err);
      resolve(url);
    });
  });
}

// Função para criar conexão WebSocket
async function createWebSocket(url: string, name: string): Promise<WebSocket> {
  console.log(`[${name}] Tentando conectar em: ${url}`);
  
  const ws = new WebSocket(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    followRedirects: true,
    handshakeTimeout: name.includes('MEXC') ? 30000 : 10000 // Aumenta timeout para MEXC
  });

  let subscriptionInterval: NodeJS.Timeout;
  let isFirstConnection = true;

  function subscribe(symbol: TradableSymbol) {
    try {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log(`[${name}] WebSocket não está aberto para subscrição`);
        return;
      }

      const getMessage = SUBSCRIPTION_MESSAGES[name as keyof typeof SUBSCRIPTION_MESSAGES];
      if (!getMessage) {
        console.error(`[${name}] Formato de mensagem não definido`);
        return;
      }

      let symbolToUse = '';
      if (name === 'Gate.io Spot') symbolToUse = symbol.gateioSymbol;
      else if (name === 'MEXC Spot') symbolToUse = symbol.mexcSymbol;
      else if (name === 'Gate.io Futures') symbolToUse = symbol.gateioFuturesSymbol;
      else if (name === 'MEXC Futures') symbolToUse = symbol.mexcFuturesSymbol;

      const message = getMessage(symbolToUse);
      console.log(`[${name}] Enviando subscrição para ${symbolToUse}:`, JSON.stringify(message));
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[${name}] Erro ao subscrever ${symbol.baseSymbol}:`, error);
    }
  }

  ws.on('open', async () => {
    console.log(`[${name}] Conexão WebSocket estabelecida`);
    
    try {
      // Na primeira conexão, tenta subscrever imediatamente
      if (isFirstConnection) {
        isFirstConnection = false;
        const symbols = await getTradablePairs();
        console.log(`[${name}] Pares obtidos na primeira conexão:`, symbols);
        
        const defaultSymbols = symbols.length > 0 ? symbols : [{
          baseSymbol: 'BTC',
          gateioSymbol: 'BTC_USDT',
          mexcSymbol: 'BTC_USDT',
          gateioFuturesSymbol: 'BTC_USDT',
          mexcFuturesSymbol: 'BTC_USDT'
        }];

        for (const symbol of defaultSymbols) {
          subscribe(symbol);
        }
      }

      // Inicia o intervalo de resubscrição
      subscriptionInterval = setInterval(async () => {
        const symbols = await getTradablePairs();
        const defaultSymbols = symbols.length > 0 ? symbols : [{
          baseSymbol: 'BTC',
          gateioSymbol: 'BTC_USDT',
          mexcSymbol: 'BTC_USDT',
          gateioFuturesSymbol: 'BTC_USDT',
          mexcFuturesSymbol: 'BTC_USDT'
        }];

        for (const symbol of defaultSymbols) {
          subscribe(symbol);
        }
      }, SUBSCRIPTION_INTERVAL);
    } catch (error) {
      console.error(`[${name}] Erro ao iniciar subscrições:`, error);
    }
  });

  ws.on('error', (error: Error) => {
    console.error(`[${name}] Erro WebSocket:`, error);
    if (error.message.includes('403')) {
      console.log(`[${name}] Erro de autorização - verificando se precisa de autenticação`);
    }
    clearInterval(subscriptionInterval);
  });

  ws.on('unexpected-response', (request, response) => {
    console.error(`[${name}] Resposta inesperada do servidor:`, {
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      headers: response.headers
    });
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Log específico para mensagens da MEXC
      if (name.includes('MEXC')) {
        console.log(`[${name}] Mensagem recebida:`, JSON.stringify(message, null, 2));
      }
      
      // Se for uma mensagem de erro da MEXC
      if (name.includes('MEXC') && (message.code !== undefined || message.msg !== undefined)) {
        console.error(`[${name}] Erro recebido da exchange:`, JSON.stringify(message, null, 2));
      }

      processWebSocketMessage(name, data);
    } catch (error) {
      console.error(`[${name}] Erro ao processar mensagem:`, error);
    }
  });

  ws.on('close', (code: number, reason: string) => {
    console.log(`[${name}] Conexão WebSocket fechada - Código: ${code}, Razão: ${reason}`);
    clearInterval(subscriptionInterval);
    
    if (!isShuttingDown) {
      console.log(`[${name}] Tentando reconectar em ${RECONNECT_INTERVAL/1000} segundos...`);
      setTimeout(async () => {
        try {
          const checkedUrl = await checkEndpoint(url, name);
          createWebSocket(checkedUrl, name);
        } catch (error) {
          console.error(`[${name}] Erro ao reconectar:`, error);
        }
      }, RECONNECT_INTERVAL);
    }
  });

  return ws;
}

// Inicializa as conexões WebSocket
let gateioWs: WebSocket;
let mexcWs: WebSocket;
let gateioFuturesWs: WebSocket;
let mexcFuturesWs: WebSocket;

// Função para inicializar as conexões WebSocket
async function initializeWebSockets(): Promise<void> {
  try {
    gateioWs = await createWebSocket(GATEIO_WS_URL, 'Gate.io Spot');
    mexcWs = await createWebSocket(MEXC_WS_URL, 'MEXC Spot');
    gateioFuturesWs = await createWebSocket(GATEIO_FUTURES_WS_URL, 'Gate.io Futures');
    mexcFuturesWs = await createWebSocket(MEXC_FUTURES_WS_URL, 'MEXC Futures');
  } catch (error) {
    console.error('[Worker] Erro ao inicializar conexões WebSocket:', error);
  }
}

// Função para inicializar o Prisma com retry
async function initializePrisma(): Promise<void> {
  while (!isShuttingDown) {
    try {
      if (!prisma) {
        prisma = new PrismaClient();
        await prisma.$connect();
        console.log('[Worker] Conexão com o banco de dados estabelecida');
        break;
      }
    } catch (error) {
      console.error('[Worker] Erro ao conectar com o banco de dados:', error);
      console.log(`[Worker] Tentando reconectar ao banco de dados em ${DB_RETRY_INTERVAL/1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, DB_RETRY_INTERVAL));
    }
  }
}

// Função para obter pares negociáveis
async function getTradablePairs(): Promise<TradableSymbol[]> {
  try {
    if (!prisma) {
      await initializePrisma();
      if (!prisma) return []; // Se ainda não conseguiu conectar, retorna array vazio
    }
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

// Função para processar mensagens WebSocket
function processWebSocketMessage(exchange: string, data: WebSocket.Data): void {
  try {
    const message = JSON.parse(data.toString());
    console.log(`[${exchange}] Dados recebidos:`, JSON.stringify(message, null, 2));
  } catch (error) {
    console.error(`[${exchange}] Erro ao processar mensagem:`, error);
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
    
    // Se não conseguiu obter símbolos do banco, usa um conjunto padrão para manter as conexões ativas
    const defaultSymbols = symbols.length > 0 ? symbols : [{
      baseSymbol: 'BTC',
      gateioSymbol: 'BTC_USDT',
      mexcSymbol: 'BTC_USDT',
      gateioFuturesSymbol: 'BTC_USDT',
      mexcFuturesSymbol: 'BTC_USDT'
    }];
    
    for (const symbol of defaultSymbols) {
      if (isShuttingDown) break;

      try {
        // Subscreve aos canais de preço para cada símbolo
        if (gateioWs?.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            time: Date.now(),
            channel: "spot.tickers",
            event: "subscribe",
            payload: [symbol.gateioSymbol]
          };
          gateioWs.send(JSON.stringify(message));
        }

        if (mexcWs?.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            method: "SUBSCRIPTION",
            params: [`spot.ticker.${symbol.mexcSymbol}`]
          };
          mexcWs.send(JSON.stringify(message));
        }

        if (gateioFuturesWs?.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
            time: Date.now(),
            channel: "futures.tickers",
            event: "subscribe",
            payload: [symbol.gateioFuturesSymbol]
          };
          gateioFuturesWs.send(JSON.stringify(message));
        }

        if (mexcFuturesWs?.readyState === WebSocket.OPEN) {
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

// Função principal que mantém o worker rodando
async function startWorker(): Promise<void> {
  console.log('[Worker] Iniciando worker em segundo plano...');
  
  // Inicializa as conexões WebSocket
  await initializeWebSockets();
  
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
  if (gateioWs) gateioWs.close();
  if (mexcWs) mexcWs.close();
  if (gateioFuturesWs) gateioFuturesWs.close();
  if (mexcFuturesWs) mexcFuturesWs.close();
  
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Recebido sinal SIGINT, encerrando graciosamente...');
  isShuttingDown = true;
  
  // Fecha as conexões WebSocket
  if (gateioWs) gateioWs.close();
  if (mexcWs) mexcWs.close();
  if (gateioFuturesWs) gateioFuturesWs.close();
  if (mexcFuturesWs) mexcFuturesWs.close();
  
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