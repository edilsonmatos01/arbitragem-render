import ccxt, { Exchange } from 'ccxt';
// import fs from 'fs'; // Comentado - não é mais necessário se o lookup JSON for removido
// import path from 'path'; // Comentado

// Caminho para o arquivo JSON (REMOVIDO/COMENTADO)
// const tradableSymbolsPath = path.join(process.cwd(), 'public', 'tradableSymbols.json');

// Essas são as IDs que usamos em nosso projeto para identificar as exchanges.
export type SupportedExchangeId = 'gateio' | 'mexc';

// interface TradableSymbolsData { // Comentado - não é mais necessário
//   [exchange: string]: {
//     spot: string[];
//     futures: string[];
//   };
// }

interface ExchangeConfig {
  ccxtId: string;
  futuresCcxtId?: string;
  spotOptions?: Record<string, unknown>;
  futuresOptions?: Record<string, unknown>;
  symbolTransform?: (baseAsset: string, quoteAsset: string, marketType: 'spot' | 'futures') => string[];
  fundingRateEndpoint?: (symbol: string) => { endpoint: string; params: Record<string, any>; };
}

// Função para normalizar símbolos (pode ser útil em outras lógicas futuras, mantida por enquanto)
// function normalizeSymbol(symbol: string): string {
//   return symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
// }

// Gera dicionário de lookup para cada exchange e tipo de mercado (REMOVIDO/COMENTADO)
// let symbolLookup: Record<SupportedExchangeId, { spot: Record<string, string>, futures: Record<string, string> }> | null = null;

// function getSymbolLookup(): Record<SupportedExchangeId, { spot: Record<string, string>, futures: Record<string, string> }> { // REMOVIDO/COMENTADO
  // ... (toda a lógica de getSymbolLookup foi removida)
// }

const exchangeConfigs: Record<SupportedExchangeId, ExchangeConfig> = {
  gateio: { 
    ccxtId: 'gateio',
    // symbolTransform removido
    fundingRateEndpoint: (symbol: string) => ({
      endpoint: 'swapPublicGetSettleFundingRate',
      params: { settle: 'usdt', contract: symbol.includes('_') ? symbol : symbol.replace('/', '_') }
    })
  },
  mexc: { 
    ccxtId: 'mexc',
    // symbolTransform removido
    fundingRateEndpoint: (symbol: string) => ({
      endpoint: 'swapPublicGetFundingRate',
      params: { contract: symbol.includes('_') ? symbol : symbol.replace('/', '_') }
    })
  }
};

// function similarSymbols(symbol: string, symbolList: string[]): string[] { // Comentado - era usado por findTradableSymbol
//   const [base, quote] = symbol.split('/');
//   return symbolList.filter(s => s.includes(base) || s.includes(quote));
// }

/**
 * Tenta encontrar um símbolo de mercado negociável em uma exchange para um par base/cotação e tipo de mercado.
 * (FUNÇÃO REMOVIDA/COMENTADA)
 */
// export async function findTradableSymbol(
//   baseAsset: string,
//   quoteAsset: string,
//   projectExchangeId: SupportedExchangeId,
//   marketType: 'spot' | 'futures'
// ): Promise<string | null> {
  // ... (toda a lógica de findTradableSymbol foi removida)
// }

/**
 * Busca a taxa de funding para um par específico em uma exchange
 * @param symbol Símbolo do par (ex: 'BTC/USDT' ou 'BTC_USDT' para futuros em algumas exchanges)
 * @param exchange Instância da exchange CCXT
 * @param projectExchangeId ID da exchange no nosso projeto
 * @returns Taxa de funding ou null se não disponível
 */
export async function fetchFundingRateWithRetry(
  symbol: string,
  exchange: Exchange,
  projectExchangeId: SupportedExchangeId
): Promise<number | null> {
  try {
    const config = exchangeConfigs[projectExchangeId];
    if (!config.fundingRateEndpoint) {
      // console.warn(`[fetchFundingRate] No fundingRateEndpoint config for ${projectExchangeId}`);
      return null;
    }
    const { endpoint, params } = config.fundingRateEndpoint(symbol);
    
    // ... (lógica restante de fetchFundingRateWithRetry permanece, pois ainda pode ser útil)
    // ... (mas notamos que ela também usa a estrutura de `config` que tinha `symbolTransform`)
    // ... Se `symbolTransform` fosse crucial para formatar o símbolo para `fundingRateEndpoint`,
    // ... essa função também precisaria de ajuste. Por ora, mantemos.
    let rateData: any;
    switch (projectExchangeId) {
      case 'mexc':
        rateData = await (exchange as any)[endpoint]({ ...params, contract: symbol.includes('_') ? symbol : symbol.replace('/', '_') });
        return parseFloat(rateData.data.fundingRate);
      case 'gateio':
        rateData = await (exchange as any)[endpoint]({ ...params, contract: symbol.includes('_') ? symbol : symbol.replace('/', '_') });
        if (Array.isArray(rateData) && rateData.length > 0) {
          const specificRate = rateData.find(r => r.contract === (symbol.includes('_') ? symbol : symbol.replace('/', '_')));
          return parseFloat(specificRate ? specificRate.r : rateData[0].r);
        }
        return parseFloat(rateData.r);
      default:
        // console.warn(`[fetchFundingRate] Unsupported exchange for direct endpoint call: ${projectExchangeId}`);
        // Fallback to generic fetchFundingRate if available on exchange instance
        if (typeof exchange.fetchFundingRate === 'function') {
          const genericRate = await exchange.fetchFundingRate(symbol);
          return genericRate?.fundingRate ?? null;
        } 
        return null;
    }
  } catch (error) {
    // console.warn(`[fetchFundingRate] Error fetching funding rate for ${symbol} on ${projectExchangeId}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
} 