import { PrismaClient } from '@prisma/client';
import ccxt from 'ccxt';
import { calculateSpread } from '../app/utils/spreadUtils';
import cron from 'node-cron';

// Inicializa o cliente Prisma
const prisma = new PrismaClient();

// Configurações das exchanges
const gateio = new ccxt.gateio({
  enableRateLimit: true,
});

const mexc = new ccxt.mexc({
  enableRateLimit: true,
});

// Lista de pares a serem monitorados
const TARGET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'DOGE/USDT', 'SOL/USDT', 'PEPE/USDT', 
  'UNI/USDT', 'SUI/USDT', 'ONDO/USDT', 'WLD/USDT', 'FET/USDT', 'ARKM/USDT', 
  'INJ/USDT', 'TON/USDT', 'OP/USDT', 'XRP/USDT', 'KAS/USDT', 'VR/USDT', 
  'G7/USDT', 'EDGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT'
];

let isCronRunning = false;

async function monitorSpreads() {
  if (isCronRunning) {
    console.log('Monitoramento já está em execução, ignorando esta chamada');
    return;
  }

  try {
    isCronRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando monitoramento de spreads...`);

    // Carrega os mercados das exchanges
    await Promise.all([
      gateio.loadMarkets(),
      mexc.loadMarkets()
    ]);

    // Para cada par de trading
    for (const symbol of TARGET_PAIRS) {
      try {
        // Busca os preços atuais
        const [spotTicker, futuresTicker] = await Promise.all([
          gateio.fetchTicker(symbol),
          mexc.fetchTicker(`${symbol}:USDT`) // Formato para futuros na MEXC
        ]);

        // Extrai os preços
        const spotPrice = spotTicker?.ask;
        const futuresPrice = futuresTicker?.bid;

        // Valida os preços
        if (!spotPrice || !futuresPrice || spotPrice <= 0 || futuresPrice <= 0) {
          console.warn(`Preços inválidos para ${symbol}: Spot=${spotPrice}, Futures=${futuresPrice}`);
          continue;
        }

        // Calcula o spread
        const spread = calculateSpread(futuresPrice.toString(), spotPrice.toString());
        const spreadValue = spread ? parseFloat(spread) : null;

        if (spreadValue === null) {
          console.warn(`Spread inválido para ${symbol}`);
          continue;
        }

        // Salva no banco de dados
        await prisma.spreadHistory.create({
          data: {
            symbol,
            exchangeBuy: 'gateio',
            exchangeSell: 'mexc',
            direction: 'spot-to-future',
            spread: spreadValue,
            spotPrice: spotPrice,
            futuresPrice: futuresPrice,
            timestamp: new Date()
          }
        });

        console.log(`[${new Date().toISOString()}] ${symbol}: Spread=${spreadValue}%, Spot=${spotPrice}, Futures=${futuresPrice}`);

      } catch (error) {
        console.error(`Erro ao processar ${symbol}:`, error);
        continue;
      }
    }

  } catch (error) {
    console.error('Erro no monitoramento:', error);
  } finally {
    isCronRunning = false;
  }
}

// Inicia o agendador para executar a cada 30 minutos
cron.schedule('*/30 * * * *', monitorSpreads);

// Executa imediatamente na primeira vez
monitorSpreads();

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