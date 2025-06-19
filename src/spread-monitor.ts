import db from './db-client';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import { calculateSpreadPercentage } from './utils';

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

const gateio = new GateIoConnector(
  process.env.GATE_API_KEY || '',
  process.env.GATE_SECRET || '',
  'spot'
);

const mexc = new MexcConnector(
  process.env.MEXC_API_KEY || '',
  process.env.MEXC_SECRET || ''
);

async function monitorSpread() {
  try {
    for (const symbol of symbols) {
      try {
        const [gateioPrice, mexcPrice] = await Promise.all([
          gateio.getSpotPrice(symbol),
          mexc.getSpotPrice(symbol)
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