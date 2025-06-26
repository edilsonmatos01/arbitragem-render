import { PrismaClient } from '@prisma/client';
import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';
import { GateIoFuturesConnector } from './connectors/gateio-futures-connector';
import { MexcFuturesConnector } from './connectors/mexc-futures-connector';
import { calculateSpread } from './utils';

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

// Configurações do worker
const MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutos em milissegundos
let isWorkerRunning = false;
let isShuttingDown = false;

// Função para processar atualizações de preço
const handlePriceUpdate = (data: MarketPrice) => {
  console.log(`[Worker] Atualização de preço para ${data.symbol}`);
};

// Função de callback para conexão
const handleConnected = () => {
  console.log('[Worker] Conexão estabelecida com sucesso');
};

// Inicializa os conectores com as credenciais do ambiente
const gateioSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);
const gateioFutures = new GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate, handleConnected);
const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);

async function monitorAndStore() {
  if (isWorkerRunning) {
    console.log('[Worker] Monitoramento já está em execução, ignorando esta chamada');
    return;
  }

  try {
    isWorkerRunning = true;
    console.log(`[Worker ${new Date().toISOString()}] Iniciando monitoramento...`);
    
    // Obtém lista de símbolos negociáveis da tabela TradableSymbol
    const symbols = await prisma.$queryRaw<TradableSymbol[]>`
      SELECT "baseSymbol", "gateioSymbol", "mexcSymbol", "gateioFuturesSymbol", "mexcFuturesSymbol"
      FROM "TradableSymbol"
      WHERE "isActive" = true
    `;
    
    for (const symbol of symbols) {
      if (isShuttingDown) break;

      try {
        // Coleta preços spot e futures
        const [gateioSpotPrices, mexcSpotPrices, gateioFuturesPrices, mexcFuturesPrices] = await Promise.all([
          gateioSpot.getTradablePairs(),
          mexcSpot.getTradablePairs(),
          gateioFutures.getTradablePairs(),
          mexcFutures.getTradablePairs()
        ]);

        // Filtra os preços para o símbolo atual
        const gateioSpotPrice = gateioSpotPrices.find((p: string) => p === symbol.gateioSymbol);
        const mexcSpotPrice = mexcSpotPrices.find((p: string) => p === symbol.mexcSymbol);
        const gateioFuturesPrice = gateioFuturesPrices.find((p: string) => p === symbol.gateioFuturesSymbol);
        const mexcFuturesPrice = mexcFuturesPrices.find((p: string) => p === symbol.mexcFuturesSymbol);

        if (!gateioSpotPrice || !mexcSpotPrice || !gateioFuturesPrice || !mexcFuturesPrice) {
          console.warn(`[Worker] Preços incompletos para ${symbol.baseSymbol}`);
          continue;
        }

        // Calcula spreads
        const gateioSpotToMexcFutures = calculateSpread(gateioSpotPrice, mexcFuturesPrice);
        const mexcSpotToGateioFutures = calculateSpread(mexcSpotPrice, gateioFuturesPrice);

        const timestamp = new Date();

        // Salva os dados em uma transação
        await prisma.$transaction([
          prisma.$executeRaw`
            INSERT INTO "PriceHistory" (
              "id",
              "symbol",
              "timestamp",
              "gateioSpotAsk",
              "gateioSpotBid",
              "mexcSpotAsk",
              "mexcSpotBid",
              "gateioFuturesAsk",
              "gateioFuturesBid",
              "mexcFuturesAsk",
              "mexcFuturesBid",
              "gateioSpotToMexcFuturesSpread",
              "mexcSpotToGateioFuturesSpread"
            ) VALUES (
              gen_random_uuid(),
              ${symbol.baseSymbol},
              ${timestamp},
              ${Number(gateioSpotPrice)},
              ${Number(gateioSpotPrice)},
              ${Number(mexcSpotPrice)},
              ${Number(mexcSpotPrice)},
              ${Number(gateioFuturesPrice)},
              ${Number(gateioFuturesPrice)},
              ${Number(mexcFuturesPrice)},
              ${Number(mexcFuturesPrice)},
              ${gateioSpotToMexcFutures},
              ${mexcSpotToGateioFutures}
            )
          `,
          prisma.$executeRaw`
            INSERT INTO "SpreadHistory" (
              "id",
              "symbol",
              "exchangeBuy",
              "exchangeSell",
              "direction",
              "spread",
              "timestamp"
            ) VALUES (
              gen_random_uuid(),
              ${symbol.baseSymbol},
              'GATEIO',
              'MEXC',
              'spot-to-future',
              ${gateioSpotToMexcFutures},
              ${timestamp}
            )
          `,
          prisma.$executeRaw`
            INSERT INTO "SpreadHistory" (
              "id",
              "symbol",
              "exchangeBuy",
              "exchangeSell",
              "direction",
              "spread",
              "timestamp"
            ) VALUES (
              gen_random_uuid(),
              ${symbol.baseSymbol},
              'MEXC',
              'GATEIO',
              'spot-to-future',
              ${mexcSpotToGateioFutures},
              ${timestamp}
            )
          `
        ]);

        console.log(`[Worker] Dados salvos para ${symbol.baseSymbol}`);
      } catch (symbolError) {
        console.error(`[Worker] Falha ao processar ${symbol.baseSymbol}:`, symbolError);
        continue;
      }
    }
  } catch (error) {
    console.error('[Worker] Falha no monitoramento:', error);
  } finally {
    isWorkerRunning = false;
  }
}

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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Recebido sinal SIGINT, encerrando graciosamente...');
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
});

// Inicia o worker
startWorker().catch(error => {
  console.error('[Worker] Erro fatal:', error);
  process.exit(1);
}); 