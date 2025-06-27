export declare class MexcFuturesConnector {
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
    private heartbeatInterval;
    private readonly HEARTBEAT_INTERVAL;
    private reconnectTimeout;
    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function);
    private startHeartbeat;
    private stopHeartbeat;
    private cleanup;
    private handleDisconnect;
    connect(): Promise<void>;
    subscribe(pairs: string[]): void;
    private resubscribeAll;
    disconnect(): void;
    getTradablePairs(): Promise<string[]>;
}
