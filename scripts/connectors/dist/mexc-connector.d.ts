import { EventEmitter } from 'events';
interface PriceUpdate {
    identifier: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
}
export declare class MexcConnector extends EventEmitter {
    private ws;
    private subscriptions;
    private pingInterval;
    private priceUpdateCallback;
    private onConnectedCallback;
    private isConnected;
    private marketIdentifier;
    private readonly identifier;
    private readonly REST_URL;
    constructor(identifier: string, priceUpdateCallback: (data: PriceUpdate) => void, onConnected: () => void);
    connect(): void;
    subscribe(symbols: string[]): void;
    private onOpen;
    private sendSubscriptionRequests;
    private onMessage;
    private onClose;
    private onError;
    private startPing;
    private stopPing;
    disconnect(): void;
    getTradablePairs(): Promise<string[]>;
}
export {};
