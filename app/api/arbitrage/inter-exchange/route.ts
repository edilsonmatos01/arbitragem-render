import { NextResponse } from 'next/server';
import ccxt, { Exchange } from 'ccxt';
// import { COMMON_BASE_ASSETS, COMMON_QUOTE_ASSET } from '@/lib/constants'; // Removido
import { SupportedExchangeId } from '@/lib/exchangeUtils';
import { recordSpread } from '@/lib/spread-tracker'; // Importar a função

// Nova lista de pares de moedas
const TARGET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'DOGE/USDT', 'SOL/USDT', 'PEPE/USDT', 
  'UNI/USDT', 'SUI/USDT', 'ONDO/USDT', 'WLD/USDT', 'FET/USDT', 'ARKM/USDT', 
  'INJ/USDT', 'TON/USDT', 'OP/USDT', 'XRP/USDT', 'KAS/USDT', 'VR/USDT', 
  'G7/USDT', 'EDGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 
  'LTC/USDT', 'TRX/USDT', 'SHIB/USDT', 'ATOM/USDT', 'LINK/USDT', 'NEAR/USDT', 
  'APT/USDT', 'ARB/USDT', 'FIL/USDT', 'SAND/USDT', 'AAVE/USDT', 'EOS/USDT', 
  'FLOW/USDT', 'GALA/USDT', 'ALGO/USDT', 'CHZ/USDT', 'TRUMP/USDT', 
  'MOODENG/USDT', 'TAO/USDT', 'POPCAT/USDT', 'HYPE/USDT', 'BOXCAT/USDT', 
  'PI/USDT', 'MASK/USDT', 'ZRC/USDT', 'ZEN/USDT', 'RPL/USDT', 'SOPH/USDT', 
  'STARTUP/USDT', 'NEIROETH/USDT', 'FLOCK/USDT', 'FARTCOIN/USDT', 
  'PURR/USDT', 'ENA/USDT', 'KEKIUS/USDT', 'BID/USDT', 'ME/USDT', 
  'EDGEN/USDT', 'BOBBSC/USDT', 'YND/USDT', 'BDXN/USDT', 'GOONC/USDT', 
  'TRUMPOFFICIAL/USDT', 'SWAN/USDT', 'WIF/USDT', 'COMP/USDT', 'VTHO/USDT', 
  'AGI/USDT', 'AEVO/USDT', 'QNT/USDT', 'FDUSD/USDT', 'CAT/USDT', 
  'HMSTR/USDT', 'CKB/USDT', 'ETHW/USDT', 'SOON/USDT', 'ORBS/USDT', 
  'BMT/USDT', 'KEY/USDT', 'BANANA/USDT', 'SANTOS/USDT', 'PIXEL/USDT', 
  'CHILLGUY/USDT', 'BSW/USDT', 'HOT/USDT', 'SUSHI/USDT', 'UXLINK/USDT', 
  'FTN/USDT', 'HIVE/USDT', 'SCRT/USDT', 'BTT/USDT', 'HIPPO/USDT', 
  'SLERF/USDT', 'MANTA/USDT', 'AI/USDT', 'SWELL/USDT', 'TGT/USDT', 
  'MEMEFI/USDT', 'VVV/USDT', 'AI16Z/USDT', 'AIOZ/USDT', 'MAGIC/USDT', 
  'PFVS/USDT', 'BOME/USDT', 'RUNE/USDT', 'ACX/USDT', 'DOLO/USDT', 
  'REQ/USDT', 'DEGO/USDT', 'MOBILE/USDT', 'AUDIO/USDT', 'BOBA/USDT', 
  'J/USDT', 'STX/USDT', 'LOOM/USDT', 'INIT/USDT', 'PUNDIX/USDT', 
  'EGLD/USDT', 'THE/USDT', 'ANKR/USDT', 'ROSE/USDT', 'SAGA/USDT', 
  'AIXBT/USDT', 'D/USDT', 'CPOOL/USDT', 'BENQI/USDT', 'PIN/USDT', 
  'BRISE/USDT', 'VELAAI/USDT', 'BUBB/USDT', 'GNC/USDT', 'DADDY/USDT', 
  'FRED/USDT', '1DOLLAR/USDT', 'GEAR/USDT', 'WHITE/USDT', 'ANON/USDT', 
  'RBNT/USDT', 'TOMI/USDT', 'DEAI/USDT', 'BUZZ/USDT', 'LUCE/USDT', 
  'VVAIFU/USDT', 'HOLD/USDT', 'ACA/USDT', 'FARM/USDT', 'SUPRA/USDT', 
  'ALPACA/USDT', 'NAVX/USDT', 'MICHI/USDT', 'DAG/USDT', 'ORAI/USDT'
];

// Helper para validar se a string é uma SupportedExchangeId
function isValidSupportedExchangeId(id: string): id is SupportedExchangeId {
  return ['gateio', 'mexc'].includes(id);
}

// Helper para obter uma instância da CCXT de forma segura
function getCcxtInstance(exchangeId: SupportedExchangeId): Exchange | null {
  if (!ccxt.exchanges.includes(exchangeId)) {
    console.error(`Inter-Exchange: CCXT exchange ID '${exchangeId}' não é válida ou disponível.`);
    return null;
  }
  const ExchangeConstructor = ccxt[exchangeId as keyof typeof ccxt] as typeof Exchange;
  if (typeof ExchangeConstructor !== 'function') {
    console.error(`Inter-Exchange: Construtor CCXT não encontrado para ID: ${exchangeId}`);
    return null;
  }
  // As credenciais podem ser adicionadas aqui se necessário para fetchTicker/fetchFundingRate
  // Por enquanto, operações públicas.
  return new ExchangeConstructor({ enableRateLimit: true });
}

function mapDirectionToTracker(apiDirection: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES'): 'spot-to-future' | 'future-to-spot' {
  return apiDirection === 'FUTURES_TO_SPOT' ? 'spot-to-future' : 'future-to-spot';
}

export async function POST(req: Request) {
  try {
    const { spotExchange: spotExchangeIdString, futuresExchange: futuresExchangeIdString, direction: requestedDirection } = await req.json();

    if (!spotExchangeIdString || !futuresExchangeIdString) {
      return NextResponse.json({ error: 'spotExchange e futuresExchange são obrigatórios no corpo da requisição.' }, { status: 400 });
    }

    if (!isValidSupportedExchangeId(spotExchangeIdString) || !isValidSupportedExchangeId(futuresExchangeIdString)) {
      return NextResponse.json({ error: 'Valores inválidos para spotExchange ou futuresExchange.' }, { status: 400 });
    }

    const spotExchangeId: SupportedExchangeId = spotExchangeIdString;
    const futuresExchangeId: SupportedExchangeId = futuresExchangeIdString;

    const spotEx = getCcxtInstance(spotExchangeId);
    const futEx = getCcxtInstance(futuresExchangeId);

    if (!spotEx || !futEx) {
      return NextResponse.json({ error: 'Falha ao instanciar uma ou ambas as exchanges.', details: `Spot: ${spotEx ? 'OK' : spotExchangeId}, Futures: ${futEx ? 'OK' : futuresExchangeId}` }, { status: 500 });
    }

    await spotEx.loadMarkets();
    await futEx.loadMarkets();
    
    const dynamicallyFoundPairsInfo = [];
    for (const marketSymbol of TARGET_PAIRS) {
      const spotMarket = spotEx.markets[marketSymbol];
      const futuresMarket = futEx.markets[marketSymbol];
      const isSpotActive = spotMarket && (spotMarket.active !== false);
      const isFuturesActive = futuresMarket && (futuresMarket.active !== false);
      if (isSpotActive && isFuturesActive) {
        dynamicallyFoundPairsInfo.push({ marketSymbol }); 
      }
    }

    if (dynamicallyFoundPairsInfo.length === 0) {
      console.log(`Inter-Exchange (${spotExchangeId} / ${futuresExchangeId}) - Nenhum par válido encontrado na lista TARGET_PAIRS.`);
      return NextResponse.json({ result: { list: [] }, retCode: 0, retMsg: 'OK, nenhum par encontrado para a lista fornecida' });
    }

    const results = await Promise.all(dynamicallyFoundPairsInfo.map(async (pairInfo) => {
      try {
        const spotTicker = await spotEx.fetchTicker(pairInfo.marketSymbol);
        const futuresTicker = await futEx.fetchTicker(pairInfo.marketSymbol);
        let fundingRate = "0";
        try {
          const fundingRateData = await futEx.fetchFundingRate(pairInfo.marketSymbol);
          if (typeof fundingRateData?.fundingRate === 'number') {
            fundingRate = fundingRateData.fundingRate.toString();
          }
        } catch (frError) {
            console.warn(`Inter-Exchange (${futuresExchangeId}) - Não foi possível buscar funding rate para ${pairInfo.marketSymbol}: ${frError instanceof Error ? frError.message : String(frError)}`);
        }

        const spotAsk = spotTicker.ask;
        const futuresBid = futuresTicker.bid;

        if (!spotAsk || !futuresBid || spotAsk <=0 || futuresBid <=0) {
            console.warn(`Inter-Exchange - Preços ask/bid ausentes para ${pairInfo.marketSymbol} (Spot ${spotExchangeId}) ou (Futures ${futuresExchangeId})`);
            return null;
        }

        const percentDiff = (futuresBid - spotAsk) / spotAsk;
        const calculatedApiDirection = percentDiff > 0 ? 'FUTURES_TO_SPOT' : 'SPOT_TO_FUTURES';

        if (requestedDirection && requestedDirection !== 'ALL' && calculatedApiDirection !== requestedDirection) {
          return null;
        }
        
        // Record spread for history
        if (percentDiff !== 0) {
          recordSpread({
            symbol: pairInfo.marketSymbol,
            exchangeBuy: calculatedApiDirection === 'FUTURES_TO_SPOT' ? spotExchangeId : futuresExchangeId,
            exchangeSell: calculatedApiDirection === 'FUTURES_TO_SPOT' ? futuresExchangeId : spotExchangeId,
            direction: mapDirectionToTracker(calculatedApiDirection),
            spread: percentDiff
          }).catch(err => {
            console.error(`Inter-Exchange - Failed to record spread for ${pairInfo.marketSymbol}:`, err);
          });
        }

        return {
          symbol: pairInfo.marketSymbol, // Assuming marketSymbol is the full pair (e.g., BTC/USDT)
          spotExchange: spotExchangeId,
          futuresExchange: futuresExchangeId,
          spotPrice: spotAsk.toString(),
          futuresPrice: futuresBid.toString(),
          direction: calculatedApiDirection,
          fundingRate: fundingRate,
          percentDiff: percentDiff.toString(),
        };
      } catch (error) {
        console.error(`Inter-Exchange - Erro ao buscar dados para ${pairInfo.marketSymbol} (Spot ${spotExchangeId}, Futures ${futuresExchangeId}):`, error instanceof Error ? error.message : String(error));
        return null;
      }
    }));

    const validOpportunities = results.filter(Boolean);
    validOpportunities.sort((a, b) => Math.abs(parseFloat((b as any).percentDiff)) - Math.abs(parseFloat((a as any).percentDiff)));

    return NextResponse.json({
      result: {
        list: validOpportunities,
      },
      retCode: 0,
      retMsg: 'OK',
    });
  } catch (error) {
    console.error('Inter-Exchange - Erro geral ao buscar oportunidades de arbitragem:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao buscar oportunidades inter-corretoras', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 