import { PrismaClient } from '@prisma/client';
import { GateIoConnector } from '../src/gateio-connector';
import { MexcConnector } from '../src/mexc-connector';
import { GateIoFuturesConnector } from '../src/gateio-futures-connector';
import { MexcFuturesConnector } from '../src/mexc-futures-connector';
import { calculateSpread } from './utils';
import * as cron from 'node-cron';

// Inicializa o cliente Prisma
const prisma = new PrismaClient();

// Função para processar atualizações de preço
const handlePriceUpdate = (data: any) => {
  console.log(`[${data.identifier}] Atualização de preço para ${data.symbol}`);
};

// Inicializa os conectores com as credenciais do ambiente
const gateioSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new MexcConnector('MEXC_SPOT', handlePriceUpdate);
const gateioFutures = new GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate);
const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate);

// Lista de pares a serem monitorados
const TARGET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'DOGE/USDT', 'SOL/USDT', 'PEPE/USDT', 
  'UNI/USDT', 'SUI/USDT', 'ONDO/USDT', 'WLD/USDT', 'FET/USDT', 'ARKM/USDT', 
  'INJ/USDT', 'TON/USDT', 'OP/USDT', 'XRP/USDT', 'KAS/USDT', 'VR/USDT', 
  'G7/USDT', 'EDGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT'
];

let isCronRunning = false;

interface TickerData {
  bestAsk: number;
  bestBid: number;
}

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
        const gateioSpotPrices = await gateioSpot.getTradablePairs();
        const mexcSpotPrices = await mexcSpot.getTradablePairs();
        
        // Coleta preços futures
        const gateioFuturesPrices = await gateioFutures.getTradablePairs();
        const mexcFuturesPrices = await mexcFutures.getTradablePairs();

        // Filtra os preços para o símbolo atual
        const gateioSpotPrice = gateioSpotPrices.find(p => p === symbol.gateioSymbol);
        const mexcSpotPrice = mexcSpotPrices.find(p => p === symbol.mexcSymbol);
        const gateioFuturesPrice = gateioFuturesPrices.find(p => p === symbol.gateioFuturesSymbol);
        const mexcFuturesPrice = mexcFuturesPrices.find(p => p === symbol.mexcFuturesSymbol);

        if (!gateioSpotPrice || !mexcSpotPrice || !gateioFuturesPrice || !mexcFuturesPrice) {
          console.warn(`[AVISO] Preços incompletos para ${symbol.baseSymbol}`);
          continue;
        }

        // Calcula spreads
        const gateioSpotToMexcFutures = calculateSpread(
          Number(gateioSpotPrice),
          Number(mexcFuturesPrice)
        );

        const mexcSpotToGateioFutures = calculateSpread(
          Number(mexcSpotPrice),
          Number(gateioFuturesPrice)
        );

        // Salva os dados no banco
        await prisma.priceHistory.create({
          data: {
            symbol: symbol.baseSymbol,
            timestamp: new Date(),
            gateioSpotAsk: Number(gateioSpotPrice),
            gateioSpotBid: Number(gateioSpotPrice),
            mexcSpotAsk: Number(mexcSpotPrice),
            mexcSpotBid: Number(mexcSpotPrice),
            gateioFuturesAsk: Number(gateioFuturesPrice),
            gateioFuturesBid: Number(gateioFuturesPrice),
            mexcFuturesAsk: Number(mexcFuturesPrice),
            mexcFuturesBid: Number(mexcFuturesPrice),
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
cron.schedule('*/30 * * * *', () => {
  monitorAndStore().catch(error => {
    console.error('[ERRO] Falha ao executar monitoramento:', error);
  });
});

// Executa imediatamente na primeira vez
monitorAndStore().catch(error => {
  console.error('[ERRO] Falha ao executar monitoramento inicial:', error);
});

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