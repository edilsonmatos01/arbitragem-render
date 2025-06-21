export interface PriceData {
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