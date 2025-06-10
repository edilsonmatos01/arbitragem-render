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
} 