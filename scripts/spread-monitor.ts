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

interface TickerData {
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

        // Calcula spreads com verificação de tipo
        const gateioSpotToMexcFutures = calculateSpread(
          gateioSpotPrice ? Number(gateioSpotPrice) : 0,
          mexcFuturesPrice ? Number(mexcFuturesPrice) : 0
        );

        const mexcSpotToGateioFutures = calculateSpread(
          mexcSpotPrice ? Number(mexcSpotPrice) : 0,
          gateioFuturesPrice ? Number(gateioFuturesPrice) : 0
        );

        // Salva os dados no banco com verificação de tipo
        await prisma.$executeRaw`
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
            NOW(),
            ${gateioSpotPrice ? Number(gateioSpotPrice) : 0},
            ${gateioSpotPrice ? Number(gateioSpotPrice) : 0},
            ${mexcSpotPrice ? Number(mexcSpotPrice) : 0},
            ${mexcSpotPrice ? Number(mexcSpotPrice) : 0},
            ${gateioFuturesPrice ? Number(gateioFuturesPrice) : 0},
            ${gateioFuturesPrice ? Number(gateioFuturesPrice) : 0},
            ${mexcFuturesPrice ? Number(mexcFuturesPrice) : 0},
            ${mexcFuturesPrice ? Number(mexcFuturesPrice) : 0},
            ${gateioSpotToMexcFutures},
            ${mexcSpotToGateioFutures}
          )
        `;

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