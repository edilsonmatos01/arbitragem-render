export interface PriceData {
<<<<<<< HEAD
  bestAsk: number;
  bestBid: number;
  timestamp: number;
}

export interface MarketPrices {
  [marketIdentifier: string]: {
    [pairSymbol: string]: PriceData;
  };
}

export interface ExchangeInfo {
  exchange: string;
  price: number;
  marketType: string;
  originalSymbol: string;
}

export interface ArbitrageOpportunity {
  type: 'arbitrage';
  baseSymbol: string;
  profitPercentage: number;
  buyAt: {
    exchange: string;
    price: number;
    marketType: 'spot' | 'futures';
  };
  sellAt: {
    exchange: string;
    price: number;
    marketType: 'spot' | 'futures';
  };
  arbitrageType: string;
  timestamp: number;
}

export interface ExchangeConfig {
    spot: string;
    futures: string;
}

export interface SpreadData {
    symbol: string;
    spotExchange: string;
    futuresExchange: string;
    spotAsk: number;
    spotBid: number;
    futuresAsk: number;
    futuresBid: number;
    spread: number;
    maxSpread: number;
    timestamp: number;
}

export interface PriceUpdate {
    type: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
    identifier: string;
=======
    bestAsk: number;
    bestBid: number;
    timestamp: number;
}

export interface MarketPrices {
    [marketIdentifier: string]: {
        [pairSymbol: string]: PriceData;
    };
}

export interface ArbitrageOpportunity {
    type: 'arbitrage';
    baseSymbol: string;
    profitPercentage: number;
    buyAt: {
        exchange: string;
        price: number;
        marketType: 'spot' | 'futures';
        originalSymbol?: string;
    };
    sellAt: {
        exchange: string;
        price: number;
        marketType: 'spot' | 'futures';
        originalSymbol?: string;
    };
    arbitrageType: string;
    timestamp: number;
    spMax?: number;
    spMin?: number;
    crosses?: number;
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
} 