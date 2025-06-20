export interface ExchangePrice {
  bestAsk: number;
  bestBid: number;
  timestamp: number;
}

export interface MarketPrices {
  [exchange: string]: {
    [symbol: string]: ExchangePrice;
  };
}

export interface ExchangeInfo {
  exchange: string;
  price: number;
  marketType: string;
  originalSymbol: string;
}

export interface ArbitrageOpportunity {
  type: string;
  symbol: string;
  baseSymbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  profitPercentage: number;
  timestamp: number;
  buyAt: ExchangeInfo;
  sellAt: ExchangeInfo;
  arbitrageType: string;
} 