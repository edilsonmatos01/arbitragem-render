import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { recordSpread } from '@/lib/spread-tracker'; // Importar a função

const API_KEY = process.env.GATEIO_API_KEY;
const API_SECRET = process.env.GATEIO_API_SECRET;
const EXCHANGE_NAME_FOR_LOG = 'Gate.io';
const EXCHANGE_ID = 'gateio'; // Para registrar nas exchanges

// Nova lista de pares de moedas
const TARGET_PAIRS = [
  'BTC/USDT', 'G7/USDT', 'NAKA/USDT', 'VR/USDT', 'WMTX/USDT', 'PIN/USDT', 
  'WILD/USDT', 'MICHI/USDT', 'BFTOKEN/USDT', 'VELAAI/USDT', 'GEAR/USDT', 
  'GNC/USDT', 'DADDY/USDT', 'SUPRA/USDT', 'MAGA/USDT', 'TARA/USDT', 
  'BERT/USDT', 'AO/USDT', 'EDGE/USDT', 'FARM/USDT', 'VVAIFU/USDT', 
  'DAG/USDT', 'DEAI/USDT', 'PEPECOIN/USDT', 'BUBB/USDT', 'TREAT/USDT', 
  'ALPACA/USDT', 'FRED/USDT', 'BUZZ/USDT', 'RBNT/USDT', 'TOMI/USDT', 
  'LUCE/USDT', 'WAXP/USDT', 'NAVX/USDT', 'ACA/USDT', 'SWAN/USDT', 
  'WHITE/USDT', 'RIFSOL/USDT', 'ALCX/USDT', 'GORK/USDT', '1DOLLAR/USDT', 
  'ALPINE/USDT', 'ANON/USDT', 'CITY/USDT', 'ILV/USDT', 'CATTON/USDT', 
  'ORAI/USDT', 'HOLD/USDT', 'BRISE/USDT'
];

function mapDirectionToTracker(apiDirection: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES'): 'spot-to-future' | 'future-to-spot' {
  return apiDirection === 'FUTURES_TO_SPOT' ? 'spot-to-future' : 'future-to-spot';
}

// Função centralizada para cálculo do spread
function calculateSpread(spotAsk: number, futuresBid: number): number | null {
    // Validação rigorosa dos inputs
    if (!spotAsk || !futuresBid || 
        spotAsk <= 0 || futuresBid <= 0 ||
        !isFinite(spotAsk) || !isFinite(futuresBid) ||
        isNaN(spotAsk) || isNaN(futuresBid)) {
        return null;
    }

    // Cálculo do spread
    const spread = ((futuresBid - spotAsk) / spotAsk) * 100;

    // Validação do resultado
    if (!isFinite(spread) || isNaN(spread) || spread <= 0) {
        return null;
    }

    return spread;
}

export async function GET() {
  try {
    const exchange = new ccxt.gateio({
      apiKey: API_KEY,
      secret: API_SECRET,
      enableRateLimit: true,
    });

    await exchange.loadMarkets();
    const opportunities = [];

    for (const spotSymbol of TARGET_PAIRS) {
      const futuresSymbol = `${spotSymbol}:USDT`;

      try {
        const spotMarket = exchange.markets[spotSymbol];
        const futuresMarket = exchange.markets[futuresSymbol];

        if (!spotMarket || !futuresMarket || !futuresMarket.active) {
          continue;
        }

        const [spotTicker, futuresTicker] = await Promise.all([
          exchange.fetchTicker(spotSymbol),
          exchange.fetchTicker(futuresSymbol)
        ]);

        const spotAsk = spotTicker?.ask;
        const futuresBid = futuresTicker?.bid;
        
        // Se algum dos preços for undefined, pula
        if (spotAsk === undefined || futuresBid === undefined) {
          continue;
        }

        const fundingRate = futuresTicker.info?.fundingRate || futuresTicker.info?.funding_rate || '0';

        const spread = calculateSpread(spotAsk, futuresBid);

        if (spread !== null && spread >= 0.01 && spread < 10) {
          const opportunity = {
            symbol: spotSymbol,
            spotPrice: spotAsk.toString(),
            futuresPrice: futuresBid.toString(),
            direction: 'SPOT_TO_FUTURES',
            fundingRate: fundingRate,
            percentDiff: spread.toString(),
          };
          
          opportunities.push(opportunity);
          
          recordSpread({
            symbol: spotSymbol,
            exchangeBuy: EXCHANGE_ID,
            exchangeSell: EXCHANGE_ID,
            direction: 'spot-to-future',
            spread: spread
          }).catch(err => {
            console.error(`${EXCHANGE_NAME_FOR_LOG} - Failed to record spread for ${spotSymbol}:`, err);
          });
        }
      } catch (e) {
        continue;
      }
    }

    return NextResponse.json({
      result: { list: opportunities },
      retCode: 0,
      retMsg: 'OK',
    });
  } catch (error) {
    console.error(`${EXCHANGE_NAME_FOR_LOG} - Erro geral na rota de arbitragem:`, error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `${EXCHANGE_NAME_FOR_LOG} - Erro geral na rota de arbitragem`, details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}