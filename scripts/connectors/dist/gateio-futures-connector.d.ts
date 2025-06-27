export declare class GateIoFuturesConnector {
    private ws;
    private readonly identifier;
    private readonly onPriceUpdate;
    private readonly onConnect;
    private isConnected;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    private readonly WS_URL;
    private readonly REST_URL;
    private subscribedSymbols;
    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function);
    connect(): Promise<void>;
    getTradablePairs(): Promise<string[]>;
    subscribe(pairs: string[]): void;
    private resubscribeAll;
}
