import { PrismaClient } from '@prisma/client';
import { GateIoConnector } from '../src/gateio-connector';
import { MexcConnector } from '../src/mexc-connector';
import { GateIoFuturesConnector } from '../src/gateio-futures-connector';
import { MexcFuturesConnector } from '../src/mexc-futures-connector';
import { calculateSpread } from './utils';
import cron from 'node-cron';

// Inicializa o cliente Prisma
const prisma = new PrismaClient();

// Inicializa os conectores com as credenciais do ambiente
const gateioSpot = new GateIoConnector(
  process.env.GATEIO_API_KEY || '',
  process.env.GATEIO_API_SECRET || ''
);

const mexcSpot = new MexcConnector(
  process.env.MEXC_API_KEY || '',
  process.env.MEXC_API_SECRET || ''
);

const gateioFutures = new GateIoFuturesConnector(
  process.env.GATEIO_API_KEY || '',
  process.env.GATEIO_API_SECRET || ''
);

const mexcFutures = new MexcFuturesConnector(
  process.env.MEXC_API_KEY || '',
  process.env.MEXC_API_SECRET || ''
);

// Lista de pares a serem monitorados
const TARGET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'DOGE/USDT', 'SOL/USDT', 'PEPE/USDT', 
  'UNI/USDT', 'SUI/USDT', 'ONDO/USDT', 'WLD/USDT', 'FET/USDT', 'ARKM/USDT', 
  'INJ/USDT', 'TON/USDT', 'OP/USDT', 'XRP/USDT', 'KAS/USDT', 'VR/USDT', 
  'G7/USDT', 'EDGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT'
];

let isCronRunning = false;

async function monitorAndStore() {
  if (isCronRunning) {
    console.log('Monitoramento já está em execução, ignorando esta chamada');
    return;
  }

  try {
    isCronRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando monitoramento...`);
    
    // Obtém lista de símbolos negociáveis da tabela TradableSymbol
    const symbols = await prisma.tradableSymbol.findMany();
    
    for (const symbol of symbols) {
      try {
        // Coleta preços spot
        const gateioSpotPrices = await gateioSpot.fetchTicker(symbol.gateioSymbol);
        const mexcSpotPrices = await mexcSpot.fetchTicker(symbol.mexcSymbol);
        
        // Coleta preços futures
        const gateioFuturesPrices = await gateioFutures.fetchTicker(symbol.gateioFuturesSymbol);
        const mexcFuturesPrices = await mexcFutures.fetchTicker(symbol.mexcFuturesSymbol);

        // Calcula spreads
        const gateioSpotToMexcFutures = calculateSpread(
          gateioSpotPrices.bestAsk,
          mexcFuturesPrices.bestBid
        );

        const mexcSpotToGateioFutures = calculateSpread(
          mexcSpotPrices.bestAsk,
          gateioFuturesPrices.bestBid
        );

        // Salva os dados no banco
        await prisma.priceHistory.create({
          data: {
            symbol: symbol.baseSymbol,
            timestamp: new Date(),
            gateioSpotAsk: gateioSpotPrices.bestAsk,
            gateioSpotBid: gateioSpotPrices.bestBid,
            mexcSpotAsk: mexcSpotPrices.bestAsk,
            mexcSpotBid: mexcSpotPrices.bestBid,
            gateioFuturesAsk: gateioFuturesPrices.bestAsk,
            gateioFuturesBid: gateioFuturesPrices.bestBid,
            mexcFuturesAsk: mexcFuturesPrices.bestAsk,
            mexcFuturesBid: mexcFuturesPrices.bestBid,
            gateioSpotToMexcFuturesSpread: gateioSpotToMexcFutures,
            mexcSpotToGateioFuturesSpread: mexcSpotToGateioFutures
          }
        });

        console.log(`[MONITOR] Dados salvos para ${symbol.baseSymbol}`);
      } catch (symbolError) {
        console.error(`[ERRO] Falha ao processar ${symbol.baseSymbol}:`, symbolError);
        continue; // Continua para o próximo símbolo em caso de erro
      }
    }
  } catch (error) {
    console.error('[ERRO] Falha no monitoramento:', error);
  } finally {
    isCronRunning = false;
    // Garante que a conexão com o banco seja fechada
    await prisma.$disconnect();
  }
}

// Inicia o agendador para executar a cada 30 minutos
cron.schedule('*/30 * * * *', monitorAndStore);

// Executa imediatamente na primeira vez
monitorAndStore();

// Mantém o processo rodando
process.on('SIGTERM', async () => {
  console.log('Encerrando monitoramento...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Encerrando monitoramento...');
  await prisma.$disconnect();
  process.exit(0);
}); 