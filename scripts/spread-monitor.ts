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

// Inicializa o cliente Prisma
const prisma = new PrismaClient();

// Variáveis globais
let targetPairs: string[] = [];
let isShuttingDown = false;
let isCronRunning = false;

// Função para processar atualizações de preço
const handlePriceUpdate = (data: MarketPrice) => {
  console.log(`Atualização de preço para ${data.symbol}`);
};

// Função de callback para conexão
const handleConnected = () => {
  console.log('Conexão estabelecida com sucesso');
};

// Inicializa os conectores
const gateioSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);
const gateioFutures = new GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate, handleConnected);
const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);

async function findCommonPairs() {
  try {
    console.log('Buscando pares negociáveis em todas as exchanges...');
    
    // Obtém lista de pares de cada exchange
    const [gateioSpotPairs, mexcSpotPairs, gateioFuturesPairs, mexcFuturesPairs] = await Promise.all([
      gateioSpot.getTradablePairs(),
      mexcSpot.getTradablePairs(),
      gateioFutures.getTradablePairs(),
      mexcFutures.getTradablePairs()
    ]);

    // Encontra pares em comum
    const commonPairs = gateioSpotPairs.filter(pair => 
      mexcSpotPairs.includes(pair) && 
      gateioFuturesPairs.includes(pair) && 
      mexcFuturesPairs.includes(pair)
    );

    console.log(`Encontrados ${commonPairs.length} pares em comum`);
    console.log('Primeiros 5 pares:', commonPairs.slice(0, 5));

    return commonPairs;
  } catch (error) {
    console.error('Erro ao buscar pares negociáveis:', error);
    return [];
  }
}

async function monitorAndStore() {
  if (isCronRunning) {
    console.log('Monitoramento já está em execução, ignorando esta chamada');
    return;
  }

  try {
    isCronRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando monitoramento...`);
    
    // Atualiza a lista de pares em comum
    targetPairs = await findCommonPairs();
    
    // Inscreve nos pares em todas as exchanges
    gateioSpot.connect(targetPairs);
    mexcSpot.subscribe(targetPairs);
    gateioFutures.subscribe(targetPairs);
    mexcFutures.subscribe(targetPairs);

    for (const symbol of targetPairs) {
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
        const gateioSpotPrice = gateioSpotPrices.find((p: string) => p === symbol);
        const mexcSpotPrice = mexcSpotPrices.find((p: string) => p === symbol);
        const gateioFuturesPrice = gateioFuturesPrices.find((p: string) => p === symbol);
        const mexcFuturesPrice = mexcFuturesPrices.find((p: string) => p === symbol);

        if (!gateioSpotPrice || !mexcSpotPrice || !gateioFuturesPrice || !mexcFuturesPrice) {
          console.warn(`[AVISO] Preços incompletos para ${symbol}`);
          continue;
        }

        // Calcula spreads
        const gateioSpotToMexcFutures = calculateSpread(Number(gateioSpotPrice), Number(mexcFuturesPrice));
        const mexcSpotToGateioFutures = calculateSpread(Number(mexcSpotPrice), Number(gateioFuturesPrice));

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
              ${symbol},
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
              ${symbol},
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
              ${symbol},
              'MEXC',
              'GATEIO',
              'spot-to-future',
              ${mexcSpotToGateioFutures},
              ${timestamp}
            )
          `
        ]);

        console.log(`[MONITOR] Dados salvos para ${symbol}`);
      } catch (symbolError) {
        console.error(`[ERRO] Falha ao processar ${symbol}:`, symbolError);
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
  
  // Conecta aos WebSockets
  gateioSpot.connect([]);
  mexcSpot.connect();
  gateioFutures.connect();
  mexcFutures.connect();
  
  // Aguarda um momento para as conexões se estabelecerem
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Obtém os pares e faz a subscrição
  const pairs = await findCommonPairs();
  if (pairs.length > 0) {
    gateioSpot.connect(pairs);
    mexcSpot.subscribe(pairs);
    gateioFutures.subscribe(pairs);
    mexcFutures.subscribe(pairs);
  }
  
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