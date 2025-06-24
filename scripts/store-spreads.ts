import { PrismaClient } from '@prisma/client';
import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';

// Interfaces
interface PriceUpdate {
  identifier: string;
  symbol: string;
  marketType: string;
  bestAsk: number;
  bestBid: number;
}

// Inicializa o cliente Prisma
const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'minimal',
});

// Pares de trading a serem monitorados
const TRADING_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT'
];

// Armazena os preços mais recentes
const latestPrices: {
  [symbol: string]: {
    spot?: { bestAsk: number; bestBid: number };
    futures?: { bestAsk: number; bestBid: number };
  };
} = {};

// Flag para controle de execução
let isRunning = false;

// Função para processar atualizações de preço
function handlePriceUpdate(data: PriceUpdate) {
  const { identifier, symbol, bestAsk, bestBid } = data;
  
  if (!latestPrices[symbol]) {
    latestPrices[symbol] = {};
  }

  if (identifier === 'GATEIO_SPOT') {
    latestPrices[symbol].spot = { bestAsk, bestBid };
  } else if (identifier === 'MEXC_FUTURES') {
    latestPrices[symbol].futures = { bestAsk, bestBid };
  }

  console.log(`[${new Date().toISOString()}] Atualização de preço - ${symbol} ${identifier}: Ask=${bestAsk}, Bid=${bestBid}`);
}

// Função para manipular conexão estabelecida
function handleConnected() {
  console.log(`[${new Date().toISOString()}] Conexão WebSocket estabelecida`);
}

async function storeSpreadData() {
  if (isRunning) {
    console.log('Processo já está em execução');
    return;
  }

  try {
    isRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando coleta de dados de spread...`);

    // Limpa os preços anteriores
    Object.keys(latestPrices).forEach(key => delete latestPrices[key]);

    // Inicializa os conectores
    const gateio = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const mexc = new MexcConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);

    // Conecta aos WebSockets
    gateio.connect(TRADING_PAIRS);
    mexc.connect();
    mexc.subscribe(TRADING_PAIRS);

    // Aguarda 10 segundos para receber os preços iniciais
    console.log('Aguardando recebimento dos preços iniciais...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Processa e salva os dados
    for (const symbol of TRADING_PAIRS) {
      try {
        const prices = latestPrices[symbol];
        
        if (!prices?.spot || !prices?.futures) {
          console.warn(`[${new Date().toISOString()}] Dados incompletos para ${symbol}, pulando...`);
          continue;
        }

        const spotPrice = (prices.spot.bestBid + prices.spot.bestAsk) / 2;
        const futuresPrice = (prices.futures.bestBid + prices.futures.bestAsk) / 2;
        const spreadValue = ((futuresPrice - spotPrice) / spotPrice) * 100;

        // Salva no banco de dados
        await prisma.spreadHistory.create({
          data: {
            symbol,
            exchangeBuy: 'GATEIO',
            exchangeSell: 'MEXC',
            direction: 'SPOT_TO_FUTURES',
            spread: spreadValue,
            timestamp: new Date()
          }
        });

        console.log(`[${new Date().toISOString()}] ${symbol}: Spread=${spreadValue.toFixed(4)}%, Spot=${spotPrice}, Futures=${futuresPrice}`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao processar ${symbol}:`, error);
      }
    }

    // Fecha as conexões
    if (typeof gateio.disconnect === 'function') gateio.disconnect();
    if (typeof mexc.disconnect === 'function') mexc.disconnect();

    console.log(`[${new Date().toISOString()}] Coleta de dados concluída com sucesso`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro durante a execução:`, error);
  } finally {
    isRunning = false;
    await prisma.$disconnect();
  }
}

// Executa a função principal
storeSpreadData()
  .catch(console.error)
  .finally(() => process.exit(0)); 