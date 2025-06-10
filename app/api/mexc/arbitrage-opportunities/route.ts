export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { NextResponse } from 'next/server';
import * as ccxt from 'ccxt'; // Alterado para importar como namespace
import { recordSpread } from '@/lib/spread-tracker'; // Importar a função
// import { COMMON_BASE_ASSETS, COMMON_QUOTE_ASSET } from '@/lib/constants'; // Comentado
// import { findTradableSymbol, SupportedExchangeId } from '@/lib/exchangeUtils'; // Comentado

const API_KEY = process.env.MEXC_API_KEY; 
const API_SECRET = process.env.MEXC_API_SECRET;
const EXCHANGE_NAME_FOR_LOG = 'MEXC';
const EXCHANGE_ID = 'mexc'; // Para registrar nas exchanges

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

let exchangeClient: ccxt.mexc | null = null; // Renomeado de 'exchange' para evitar conflito de nome
let clientInitializationError: string | null = null;

try {
  if (API_KEY && API_SECRET) {
    exchangeClient = new (ccxt as any).mexc({ // (ccxt as any) para manter compatibilidade se houver variações na lib
      apiKey: API_KEY,
      secret: API_SECRET,
      enableRateLimit: true,
    });
  } else {
    // Algumas chamadas CCXT podem funcionar sem API key para dados públicos
    // Mas para um teste de 'conexão autenticada' ideal, elas são necessárias.
    // Se não estiverem definidas, o teste de fetchStatus pode ainda funcionar para status público.
    console.warn(`${EXCHANGE_NAME_FOR_LOG} - API_KEY ou API_SECRET não definidos. Tentando inicialização sem credenciais.`);
    exchangeClient = new (ccxt as any).mexc({ enableRateLimit: true });
    // Poderia lançar erro se as chaves fossem estritamente necessárias para qualquer operação:
    // throw new Error('MEXC_API_KEY ou MEXC_API_SECRET não estão definidos no ambiente.');
  }
} catch (e) {
  console.error(`${EXCHANGE_NAME_FOR_LOG} - Erro ao inicializar o cliente CCXT:`, e instanceof Error ? e.message : String(e));
  clientInitializationError = e instanceof Error ? e.message : String(e);
  exchangeClient = null;
}

// const EXCHANGE_ID: SupportedExchangeId = 'mexc'; // Comentado

function mapDirectionToTracker(apiDirection: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES'): 'spot-to-future' | 'future-to-spot' {
  return apiDirection === 'FUTURES_TO_SPOT' ? 'spot-to-future' : 'future-to-spot';
}

export async function GET() {
  try {
    if (clientInitializationError || !exchangeClient) {
      console.error(`${EXCHANGE_NAME_FOR_LOG} - Cliente não inicializado devido a erro anterior:`, clientInitializationError);
      return NextResponse.json({
        result: { list: [] },
        retCode: -1,
        retMsg: `Falha ao inicializar cliente ${EXCHANGE_NAME_FOR_LOG}: ${clientInitializationError}`,
      }, { status: 503 });
    }

    // Teste de conectividade
    try {
      await exchangeClient.loadMarkets(); // Útil para garantir que os mercados estão carregados
      const balance = await exchangeClient.fetchBalance(); // Teste de saldo da carteira
      console.log(`${EXCHANGE_NAME_FOR_LOG} - Teste de conexão: Saldo da carteira:`, balance);
    } catch (connectError) {
      console.error(`${EXCHANGE_NAME_FOR_LOG} - Falha no teste de conexão com a API (fetchBalance):`, connectError instanceof Error ? connectError.message : String(connectError));
      return NextResponse.json({
        result: { list: [] },
        retCode: -1,
        retMsg: `Falha ao conectar com a API da ${EXCHANGE_NAME_FOR_LOG}`,
        details: connectError instanceof Error ? connectError.message : String(connectError)
      }, { status: 503 });
    }

    const opportunities = [];
    for (const spotSymbol of TARGET_PAIRS) { // Renomeado 'symbol' para 'spotSymbol' para clareza
      const futuresSymbol = `${spotSymbol}:USDT`; // Assumindo futuros lineares USDT-margined

      try {
        // Certifique-se de que os mercados existem
        const spotMarket = exchangeClient.markets[spotSymbol];
        const futuresMarket = exchangeClient.markets[futuresSymbol];

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
          exchangeClient.fetchTicker(spotSymbol),
          exchangeClient.fetchTicker(futuresSymbol)
        ]);

        const spotAskPrice = spotTicker.ask;       // Preço para COMPRAR no SPOT
        const spotBidPrice = spotTicker.bid;       // Preço para VENDER no SPOT
        const futuresAskPrice = futuresTicker.ask;   // Preço para COMPRAR em FUTUROS
        const futuresBidPrice = futuresTicker.bid;   // Preço para VENDER em FUTUROS
        // Para MEXC, a taxa de financiamento pode estar em ticker.info.fundingRate ou ticker.info.funding_rate
        const fundingRate = futuresTicker.info?.fundingRate || futuresTicker.info?.funding_rate || '0';

        // Oportunidade 1: Comprar Spot, Vender Futuros (Spot -> Futuros)
        if (spotAskPrice && futuresBidPrice && spotAskPrice > 0 && futuresBidPrice > 0) {
          const percentDiffSpotToFutures = (futuresBidPrice - spotAskPrice) / spotAskPrice;
          
          if (percentDiffSpotToFutures > 0) {
            const opportunity = {
              symbol: spotSymbol,
              spotPrice: spotAskPrice.toString(),
              futuresPrice: futuresBidPrice.toString(),
              direction: 'SPOT_TO_FUTURES',
              fundingRate: fundingRate,
              percentDiff: percentDiffSpotToFutures.toString(),
            };
            opportunities.push(opportunity);
            recordSpread({
              symbol: spotSymbol,
              exchangeBuy: EXCHANGE_ID,
              exchangeSell: EXCHANGE_ID,
              direction: 'spot-to-future',
              spread: percentDiffSpotToFutures
            }).catch(err => {
              console.error(`${EXCHANGE_NAME_FOR_LOG} - Failed to record spread (S->F) for ${spotSymbol}:`, err);
            });
          }
        }

        // Oportunidade 2: Comprar Futuros, Vender Spot (Futuros -> Spot)
        if (futuresAskPrice && spotBidPrice && futuresAskPrice > 0 && spotBidPrice > 0) {
          const percentDiffFuturesToSpot = (spotBidPrice - futuresAskPrice) / futuresAskPrice;

          if (percentDiffFuturesToSpot > 0) {
            const opportunity = {
              symbol: spotSymbol,
              spotPrice: spotBidPrice.toString(),
              futuresPrice: futuresAskPrice.toString(),
              direction: 'FUTURES_TO_SPOT',
              fundingRate: fundingRate,
              percentDiff: percentDiffFuturesToSpot.toString(),
            };
            opportunities.push(opportunity);
            recordSpread({
              symbol: spotSymbol,
              exchangeBuy: EXCHANGE_ID,
              exchangeSell: EXCHANGE_ID,
              direction: 'future-to-spot',
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