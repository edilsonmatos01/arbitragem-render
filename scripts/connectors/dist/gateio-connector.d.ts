interface PriceUpdate {
    identifier: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
}
/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export declare class GateIoConnector {
    private ws;
    private marketIdentifier;
    private marketType;
    private priceUpdateCallback;
    private subscriptionQueue;
    private pingInterval;
    private reconnectTimeout;
    constructor(identifier: string, priceUpdateCallback: (data: PriceUpdate) => void);
    getTradablePairs(): Promise<string[]>;
    connect(pairs: string[]): void;
    private onOpen;
    private onMessage;
    private handleTickerUpdate;
    private processSubscriptionQueue;
    private onClose;
    private onError;
    private startPinging;
    private stopPinging;
    disconnect(): void;
}
export {};
