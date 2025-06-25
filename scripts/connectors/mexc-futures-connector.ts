import WebSocket from 'ws';
import fetch from 'node-fetch';

interface PriceUpdate {
  identifier: string;
  symbol: string;
  marketType: 'spot' | 'futures';
  bestAsk: number;
  bestBid: number;
}

interface ExchangePair {
  symbol: string;
  active: boolean;
}

export class MexcFuturesConnector {
  private ws: WebSocket | null = null;
  private readonly baseUrl = 'https://contract.mexc.com';
  private readonly wsUrl = 'wss://contract.mexc.com/edge';
  private readonly identifier: string;
  private readonly onPriceUpdate: (update: PriceUpdate) => void;
  private readonly onConnect: () => void;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly reconnectDelay: number = 5000;
  private readonly REST_URL = 'https://contract.mexc.com/api/v1/contract/detail';
  private subscribedSymbols: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 20000;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    identifier: string,
    onPriceUpdate: (update: PriceUpdate) => void,
    onConnect: () => void
  ) {
    this.identifier = identifier;
    this.onPriceUpdate = onPriceUpdate;
    this.onConnect = onConnect;
    console.log(`[${this.identifier}] Conector instanciado.`);
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          const pingMessage = { "op": "ping" };
          this.ws.send(JSON.stringify(pingMessage));
          console.log(`[${this.identifier}] Ping enviado`);
        } catch (error) {
          console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
          this.handleDisconnect('Erro ao enviar ping');
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async cleanup() {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        } else {
          this.ws.terminate();
        }
        this.ws = null;
      } catch (error) {
        console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
      }
    }
    
    this.isConnected = false;
  }

  private handleDisconnect(reason: string = 'Desconexão') {
    console.log(`[${this.identifier}] Desconectado: ${reason}`);
    
    this.cleanup().then(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
        console.log(`[${this.identifier}] Tentando reconectar em ${delay}ms... (Tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimeout = setTimeout(() => {
          this.connect().catch((error: unknown) => {
            console.error(`[${this.identifier}] Erro na tentativa de reconexão:`, error);
          });
        }, delay);
        
        this.reconnectAttempts++;
      } else {
        console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
      }
    });
  }

  public async getAvailablePairs(): Promise<ExchangePair[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/contract/detail`);
      const data = await response.json() as any;
      
      return Object.values(data.data)
        .filter((pair: any) => pair.state === 0 && pair.quoteCoin === 'USDT' && pair.settleCoin === 'USDT' && pair.futureType === 1)
        .map((pair: any) => ({
          symbol: pair.symbol.replace('_', '/'),
          active: true
        }));
    } catch (error) {
      console.error('Erro ao obter pares do MEXC Futures:', error);
      return [];
    }
  }

  public async connect(symbols: string[]): Promise<void> {
    if (this.ws) {
      await this.disconnect();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          console.log('[MEXC_FUTURES] Conexão WebSocket estabelecida.');

          // Inscreve em todos os pares fornecidos
          const subscribePayload = {
            method: 'sub.depth',
            param: {}
          };

          if (this.ws) {
            this.ws.send(JSON.stringify(subscribePayload));
            console.log(`[MEXC_FUTURES] Enviada inscrição para ${symbols.length} pares.`);
          }

          this.onConnect();
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.channel === 'push.depth' && message.data) {
              const symbol = message.symbol.replace('_', '/');
              const update: PriceUpdate = {
                identifier: this.identifier,
                symbol,
                marketType: 'futures',
                bestBid: parseFloat(message.data.bids[0][0]),
                bestAsk: parseFloat(message.data.asks[0][0])
              };
              this.onPriceUpdate(update);
            }
          } catch (error) {
            console.error('[MEXC_FUTURES] Erro ao processar mensagem:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[MEXC_FUTURES] Erro na conexão WebSocket:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[MEXC_FUTURES] Conexão WebSocket fechada.');
          this.reconnect(symbols);
        });

      } catch (error) {
        console.error('[MEXC_FUTURES] Erro ao conectar:', error);
        reject(error);
      }
    });
  }

  private async reconnect(symbols: string[]): Promise<void> {
    console.log('[MEXC_FUTURES] Tentando reconectar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.connect(symbols);
  }

  public async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.on('close', () => {
          this.ws = null;
          resolve();
        });
        this.ws.close();
      } else {
        resolve();
      }
    });
  }

  async getTradablePairs(): Promise<string[]> {
    try {
      console.log(`[${this.identifier}] Buscando pares negociáveis...`);
      const response = await fetch(this.REST_URL);
      const data = await response.json();
      
      console.log(`[${this.identifier}] Resposta da API:`, JSON.stringify(data).slice(0, 200) + '...');
      
      if (!Array.isArray(data)) {
        console.error(`[${this.identifier}] Resposta inválida:`, data);
        return [];
      }

      const pairs = data
        .filter((contract: any) => {
          // Filtra apenas contratos ativos e que terminam em USDT
          return contract.state === 'ENABLED' && 
                 contract.symbol.endsWith('_USDT') &&
                 // Adiciona validações extras para garantir que são pares válidos
                 contract.symbol.includes('_') &&
                 contract.symbol.split('_').length === 2;
        })
        .map((contract: any) => contract.symbol.replace('_', '/'));

      console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
      if (pairs.length > 0) {
        console.log('Primeiros 5 pares:', pairs.slice(0, 5));
      }
      return pairs;
    } catch (error) {
      console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
      return [];
    }
  }

  subscribe(pairs: string[]) {
    if (!this.ws || !this.isConnected) {
      console.error(`[${this.identifier}] WebSocket não está conectado`);
      return;
    }

    try {
      console.log(`\n[${this.identifier}] Inscrevendo-se em ${pairs.length} pares`);
      
      // Converte os pares para o formato do MEXC (BTC/USDT -> BTC_USDT)
      const formattedPairs = pairs.map(pair => pair.replace('/', '_'));
      
      const subscribeMessage = {
        "op": "sub.ticker",
        "symbol": formattedPairs
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      pairs.forEach(symbol => this.subscribedSymbols.add(symbol));
      console.log(`[${this.identifier}] Mensagem de inscrição enviada`);
      console.log('Primeiros 5 pares inscritos:', formattedPairs.slice(0, 5));
    } catch (error) {
      console.error(`[${this.identifier}] Erro ao se inscrever nos pares:`, error);
    }
  }

  private resubscribeAll() {
    const symbols = Array.from(this.subscribedSymbols);
    if (symbols.length > 0) {
      console.log(`[${this.identifier}] Reinscrevendo em ${symbols.length} pares...`);
      this.subscribe(symbols);
    }
  }
} 