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

export async function GET() {
  try {
    const exchange = new ccxt.gateio({
      apiKey: API_KEY,
      secret: API_SECRET,
      enableRateLimit: true,
    });

    await exchange.loadMarkets();
    const opportunities = [];

    for (const spotSymbol of TARGET_PAIRS) { // Renomeado 'symbol' para 'spotSymbol' para clareza
      const futuresSymbol = `${spotSymbol}:USDT`; // Assumindo futuros lineares USDT-margined

      try {
        // Certifique-se de que os mercados existem
        const spotMarket = exchange.markets[spotSymbol];
        const futuresMarket = exchange.markets[futuresSymbol];

        if (!spotMarket) {
          // console.warn(`${EXCHANGE_NAME_FOR_LOG} - Mercado spot ${spotSymbol} não encontrado.`);
          continue;
        }
        if (!futuresMarket) {
          // console.warn(`${EXCHANGE_NAME_FOR_LOG} - Mercado de futuros ${futuresSymbol} não encontrado.`);
          continue;
        }
        if (!futuresMarket.active) {
          // console.warn(`${EXCHANGE_NAME_FOR_LOG} - Mercado de futuros ${futuresSymbol} não está ativo.`);
          continue;
        }


        const [spotTicker, futuresTicker] = await Promise.all([
          exchange.fetchTicker(spotSymbol),
          exchange.fetchTicker(futuresSymbol)
        ]);

        const spotAskPrice = spotTicker.ask;       // Preço para COMPRAR no SPOT
        const spotBidPrice = spotTicker.bid;       // Preço para VENDER no SPOT
        const futuresAskPrice = futuresTicker.ask;   // Preço para COMPRAR em FUTUROS
        const futuresBidPrice = futuresTicker.bid;   // Preço para VENDER em FUTUROS
        const fundingRate = futuresTicker.info?.funding_rate || '0'; // Pega do ticker de futuros

        // Oportunidade 1: Comprar Spot, Vender Futuros (Spot -> Futuros)
        // Queremos que futuresBidPrice (o que recebemos vendendo futuros) seja maior que spotAskPrice (o que pagamos comprando spot)
        if (spotAskPrice && futuresBidPrice && spotAskPrice > 0 && futuresBidPrice > 0) {
          const percentDiffSpotToFutures = (futuresBidPrice - spotAskPrice) / spotAskPrice;
          
          if (percentDiffSpotToFutures > 0) { // Só registrar se for uma oportunidade lucrativa (antes de taxas)
            const opportunity = {
              symbol: spotSymbol,
              spotPrice: spotAskPrice.toString(),      // Preço de compra spot
              futuresPrice: futuresBidPrice.toString(),  // Preço de venda futuros
              direction: 'SPOT_TO_FUTURES',
              fundingRate: fundingRate,
              percentDiff: percentDiffSpotToFutures.toString(),
            };
            opportunities.push(opportunity);
            recordSpread({
              symbol: spotSymbol,
              exchangeBuy: EXCHANGE_ID, 
              exchangeSell: EXCHANGE_ID, 
              direction: 'spot-to-future', // Comprando no spot, vendendo em futuros
              spread: percentDiffSpotToFutures 
            }).catch(err => {
              console.error(`${EXCHANGE_NAME_FOR_LOG} - Failed to record spread (S->F) for ${spotSymbol}:`, err);
            });
          }
        }

        // Oportunidade 2: Comprar Futuros, Vender Spot (Futuros -> Spot)
        // Queremos que spotBidPrice (o que recebemos vendendo spot) seja maior que futuresAskPrice (o que pagamos comprando futuros)
        if (futuresAskPrice && spotBidPrice && futuresAskPrice > 0 && spotBidPrice > 0) {
          const percentDiffFuturesToSpot = (spotBidPrice - futuresAskPrice) / futuresAskPrice;

          if (percentDiffFuturesToSpot > 0) { // Só registrar se for uma oportunidade lucrativa (antes de taxas)
            const opportunity = {
              symbol: spotSymbol,
              spotPrice: spotBidPrice.toString(),        // Preço de venda spot
              futuresPrice: futuresAskPrice.toString(),    // Preço de compra futuros
              direction: 'FUTURES_TO_SPOT',
              fundingRate: fundingRate, // Taxa de financiamento ainda é relevante
              percentDiff: percentDiffFuturesToSpot.toString(),
            };
            opportunities.push(opportunity);
            recordSpread({
              symbol: spotSymbol,
              exchangeBuy: EXCHANGE_ID, 
              exchangeSell: EXCHANGE_ID, 
              direction: 'future-to-spot', // Comprando em futuros, vendendo no spot
              spread: percentDiffFuturesToSpot
            }).catch(err => {
              console.error(`${EXCHANGE_NAME_FOR_LOG} - Failed to record spread (F->S) for ${spotSymbol}:`, err);
            });
          }
        }
      } catch (e) {
        // console.warn(`${EXCHANGE_NAME_FOR_LOG} - Erro ao processar par ${spotSymbol} / ${futuresSymbol}:`, e instanceof Error ? e.message : String(e));
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