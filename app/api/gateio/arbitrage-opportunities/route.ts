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
        const fundingRate = futuresTicker.info?.fundingRate || futuresTicker.info?.funding_rate || '0';
        // Pega do ticker de futuros

        // Verificar se todos os preços estão disponíveis
        if (!spotAskPrice || !spotBidPrice || !futuresAskPrice || !futuresBidPrice || 
            spotAskPrice <= 0 || spotBidPrice <= 0 || futuresAskPrice <= 0 || futuresBidPrice <= 0) {
          continue;
        }

        // Calcular preços médios para comparação mais justa
        const spotMidPrice = (spotAskPrice + spotBidPrice) / 2;
        const futuresMidPrice = (futuresAskPrice + futuresBidPrice) / 2;

        // Fórmula simplificada: Spread (%) = ((Futures - Spot) / Spot) × 100
        if (spotMidPrice > 0 && futuresMidPrice > 0) {
          const spread = ((futuresMidPrice - spotMidPrice) / spotMidPrice) * 100;
          
          // Só registrar se houver spread significativo (positivo ou negativo)
          if (Math.abs(spread) >= 0.01) { // Mínimo de 0.01% para evitar ruído
            const opportunity = {
              symbol: spotSymbol,
              spotPrice: spotMidPrice.toString(),
              futuresPrice: futuresMidPrice.toString(),
              direction: spread > 0 ? 'SPOT_TO_FUTURES' : 'FUTURES_TO_SPOT',
              fundingRate: fundingRate,
              percentDiff: Math.abs(spread).toString(), // Sempre positivo para compatibilidade
            };
            
            // Só adicionar às oportunidades se for lucrativo (spread positivo significa futures > spot)
            if (spread > 0) {
              opportunities.push(opportunity);
            }
            
            recordSpread({
              symbol: spotSymbol,
              exchangeBuy: EXCHANGE_ID, 
              exchangeSell: EXCHANGE_ID, 
              direction: spread > 0 ? 'spot-to-future' : 'future-to-spot',
              spread: Math.abs(spread)
            }).catch(err => {
              console.error(`${EXCHANGE_NAME_FOR_LOG} - Failed to record spread for ${spotSymbol}:`, err);
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