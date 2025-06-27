import WebSocket from 'ws';

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

export interface CustomWebSocket extends WebSocket {
    isAlive?: boolean;
    symbol?: string;
}

export interface ExchangeConnector {
    connect(): Promise<void>;
    disconnect(): void;
    onPriceUpdate(callback: (update: PriceUpdate) => void): void;
}

export interface PriceUpdate {
    identifier: string;
    symbol: string;
    type: 'spot' | 'futures';
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
}

export interface WebSocketMessage {
    type: string;
    data: any;
}

export interface WebSocketServer {
    wss: typeof WebSocket.Server;
    clients: Set<WebSocket>;
    start(): void;
    stop(): void;
} 