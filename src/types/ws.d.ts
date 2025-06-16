declare module 'ws' {
  import { EventEmitter } from 'events';
  import { IncomingMessage } from 'http';
  import { Duplex } from 'stream';

  class WebSocket extends EventEmitter {
    static Server: typeof WebSocketServer;
    
    constructor(address: string, options?: WebSocket.ClientOptions);
    
    readyState: number;
    protocol: string;
    
    close(code?: number, data?: string | Buffer): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;
    send(data: any, options?: { mask?: boolean; binary?: boolean }, cb?: (err?: Error) => void): void;
    
    terminate(): void;
  }

  class WebSocketServer extends EventEmitter {
    constructor(options?: WebSocket.ServerOptions, callback?: () => void);
    
    clients: Set<WebSocket>;
    
    close(cb?: (err?: Error) => void): void;
    handleUpgrade(request: IncomingMessage, socket: Duplex, upgradeHead: Buffer, callback: (client: WebSocket) => void): void;
    
    on(event: 'connection', cb: (this: WebSocket, socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'error', cb: (this: WebSocket, error: Error) => void): this;
    on(event: 'headers', cb: (this: WebSocket, headers: string[], request: IncomingMessage) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  namespace WebSocket {
    export interface Data {
      toString(): string;
    }

    export interface ClientOptions {
      protocol?: string;
      handshakeTimeout?: number;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      maxPayload?: number;
      followRedirects?: boolean;
      headers?: { [key: string]: string };
    }

    export interface PerMessageDeflateOptions {
      serverNoContextTakeover?: boolean;
      clientNoContextTakeover?: boolean;
      serverMaxWindowBits?: number;
      clientMaxWindowBits?: number;
      zlibInflateOptions?: {
        chunkSize?: number;
        windowBits?: number;
        level?: number;
        memLevel?: number;
        strategy?: number;
      };
      threshold?: number;
      concurrencyLimit?: number;
    }

    export interface ServerOptions {
      host?: string;
      port?: number;
      backlog?: number;
      server?: any;
      verifyClient?: VerifyClientCallbackAsync | VerifyClientCallbackSync;
      handleProtocols?: (protocols: Set<string>, request: IncomingMessage) => string | false;
      path?: string;
      noServer?: boolean;
      clientTracking?: boolean;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      maxPayload?: number;
    }

    export type VerifyClientCallbackAsync = (info: { origin: string; secure: boolean; req: IncomingMessage }, callback: (res: boolean, code?: number, message?: string) => void) => void;
    export type VerifyClientCallbackSync = (info: { origin: string; secure: boolean; req: IncomingMessage }) => boolean;

    export const CONNECTING: number;
    export const OPEN: number;
    export const CLOSING: number;
    export const CLOSED: number;
  }

  export = WebSocket;
} 