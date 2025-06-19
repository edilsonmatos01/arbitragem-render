import db from './db-client';
import { GateIoAdapter, MexcAdapter } from './exchange-adapters';
import { calculateSpreadPercentage } from './utils';
import { ExchangeConnector } from './types';

const symbols = [
  'BTC_USDT',
  'ETH_USDT',
  'SOL_USDT',
  'BNB_USDT',
  'XRP_USDT',
  'DOGE_USDT',
  'ADA_USDT',
  'AVAX_USDT',
  'MATIC_USDT',
  'DOT_USDT'
];

const gateio = new GateIoAdapter(
  process.env.GATE_API_KEY || '',
  process.env.GATE_SECRET || ''
);

const mexc = new MexcAdapter(
  process.env.MEXC_API_KEY || '',
  process.env.MEXC_SECRET || ''
);

async function getPrice(exchange: ExchangeConnector, symbol: string): Promise<number> {
  try {
    const ticker = await exchange.getTicker(symbol);
    return (Number(ticker.buy) + Number(ticker.sell)) / 2;
  } catch (error) {
    console.error(`Erro ao obter preço de ${symbol}:`, error);
    return 0;
  }
}

async function monitorSpread() {
  try {
    for (const symbol of symbols) {
      try {
        const [gateioPrice, mexcPrice] = await Promise.all([
          getPrice(gateio, symbol),
          getPrice(mexc, symbol)
        ]);

        if (!gateioPrice || !mexcPrice) {
          console.log(`Preço não disponível para ${symbol}`);
          continue;
        }

        const spreadPercentage = calculateSpreadPercentage(gateioPrice, mexcPrice);

        await db.createSpread({
          symbol,
          gateioPrice,
          mexcPrice,
          spreadPercentage,
          timestamp: new Date()
        });

        console.log(`${symbol}: Gate.io: ${gateioPrice}, MEXC: ${mexcPrice}, Spread: ${spreadPercentage}%`);
      } catch (error) {
        console.error(`Erro ao processar ${symbol}:`, error);
      }
    }

    // Limpa spreads antigos (mantém 7 dias)
    await db.deleteOldSpreads(7);
  } catch (error) {
    console.error('Erro no monitoramento:', error);
  }
}

// Executa a cada 5 minutos
setInterval(monitorSpread, 5 * 60 * 1000);

// Primeira execução
monitorSpread(); 