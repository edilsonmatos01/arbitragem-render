import db from './db-client';
import { GateIoAdapter, MexcAdapter } from './exchange-adapters';
import { calculateSpreadPercentage } from './utils';
import { ExchangeConnector } from './types';

// Formato dos símbolos para cada exchange
const SYMBOLS = {
  'BTC/USDT': {
    gateio: 'BTC_USDT',
    mexc: 'BTCUSDT'
  },
  'ETH/USDT': {
    gateio: 'ETH_USDT',
    mexc: 'ETHUSDT'
  },
  'SOL/USDT': {
    gateio: 'SOL_USDT',
    mexc: 'SOLUSDT'
  },
  'BNB/USDT': {
    gateio: 'BNB_USDT',
    mexc: 'BNBUSDT'
  },
  'XRP/USDT': {
    gateio: 'XRP_USDT',
    mexc: 'XRPUSDT'
  }
};

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
    for (const [baseSymbol, exchangeSymbols] of Object.entries(SYMBOLS)) {
      try {
        const [gateioPrice, mexcPrice] = await Promise.all([
          getPrice(gateio, exchangeSymbols.gateio),
          getPrice(mexc, exchangeSymbols.mexc)
        ]);

        if (!gateioPrice || !mexcPrice) {
          console.log(`Preço não disponível para ${baseSymbol}`);
          continue;
        }

        const spreadPercentage = calculateSpreadPercentage(gateioPrice, mexcPrice);

        await db.createSpread({
          symbol: baseSymbol,
          gateioPrice,
          mexcPrice,
          spreadPercentage,
          timestamp: new Date()
        });

        console.log(`${baseSymbol}: Gate.io: ${gateioPrice}, MEXC: ${mexcPrice}, Spread: ${spreadPercentage}%`);
      } catch (error) {
        console.error(`Erro ao processar ${baseSymbol}:`, error);
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