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

// Função para processar atualizações de preço
const handlePriceUpdate = (data: MarketPrice) => {
  console.log(`Atualização de preço para ${data.symbol}`);
};

// Função de callback para conexão
const handleConnected = () => {
  console.log('Conexão estabelecida com sucesso');
};

// Inicializa os conectores com as credenciais do ambiente
const gateioSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);
const gateioFutures = new GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate, handleConnected);
const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);

let isCronRunning = false;
let isShuttingDown = false;

async function monitorAndStore() {
  if (isCronRunning) {
    console.log('Monitoramento já está em execução, ignorando esta chamada');
    return;
  }

  try {
    isCronRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando monitoramento...`);
    
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
          console.warn(`[AVISO] Preços incompletos para ${symbol.baseSymbol}`);
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

        console.log(`[MONITOR] Dados salvos para ${symbol.baseSymbol}`);
      } catch (symbolError) {
        console.error(`[ERRO] Falha ao processar ${symbol.baseSymbol}:`, symbolError);
        continue;
      }
    }
  } catch (error) {
    console.error('[ERRO] Falha no monitoramento:', error);
  } finally {
    isCronRunning = false;
  }
}

// Função principal que mantém o monitoramento rodando
export async function startContinuousMonitoring() {
  console.log('Iniciando monitoramento contínuo...');
  
  while (!isShuttingDown) {
    await monitorAndStore();
    
    // Aguarda 5 minutos antes da próxima execução
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  }
}

// Tratamento de encerramento gracioso
process.on('SIGTERM', async () => {
  console.log('Recebido sinal SIGTERM, encerrando graciosamente...');
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Recebido sinal SIGINT, encerrando graciosamente...');
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
}); 