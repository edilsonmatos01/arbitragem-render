import { useEffect, useState, useRef } from 'react';

// Idealmente, esta interface ArbitrageOpportunity seria importada de um local compartilhado
// entre o backend (websocket-server.ts) e o frontend.
interface ArbitrageOpportunity {
  type: 'arbitrage'; // Assegura que estamos lidando com a mensagem correta
  baseSymbol: string; 
  profitPercentage: number;
  buyAt: {
    exchange: string;
    price: number;
    marketType: 'spot' | 'futures';
    fundingRate?: string;
    originalSymbol?: string; 
  };
  sellAt: {
    exchange: string;
    price: number;
    marketType: 'spot' | 'futures';
    fundingRate?: string;
    originalSymbol?: string; 
  };
  arbitrageType: 
    | 'spot_spot_inter_exchange'
    | 'spot_futures_inter_exchange'
    | 'futures_spot_inter_exchange'
    | 'spot_spot_intra_exchange'
    | 'spot_futures_intra_exchange'
    | 'futures_spot_intra_exchange';
    // Considere adicionar 'futures_futures_inter_exchange' se precisar distingui-lo
  timestamp: number;
  maxSpread24h?: number;
}

interface LivePrices {
    [symbol: string]: {
        [marketType: string]: {
            bestAsk: number;
            bestBid: number;
        }
    }
}

const RECONNECT_INTERVAL = 5000; // 5 segundos
const MAX_RECONNECT_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 30000; // 30 segundos

interface SpreadData {
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

export function useArbitrageWebSocket() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[DEBUG] window location:', typeof window !== 'undefined' ? window.location.href : 'undefined');
    
    // Em desenvolvimento, sempre usar URL local
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Usando URL de desenvolvimento');
      return 'ws://localhost:10000';
    }
    
    // Em produção, usar a mesma URL do Next.js com protocolo WebSocket
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;
      console.log('[DEBUG] URL WebSocket construída:', wsUrl);
      return wsUrl;
    }
    
    // Fallback para a URL específica do Render
    console.log('[DEBUG] Usando URL de fallback');
    return 'wss://robo-de-arbitragem.onrender.com';
  };

  const connect = () => {
    if (ws.current?.readyState === WebSocket.CONNECTING || 
        ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WS Hook] Máximo de tentativas de reconexão atingido');
      return;
    }

    const wsURL = getWebSocketURL();
    console.log(`[WS Hook] Tentando conectar ao servidor WebSocket em ${wsURL}... (Tentativa ${reconnectAttempts.current + 1})`);
    
    try {
      ws.current = new WebSocket(wsURL);

      ws.current.onopen = () => {
        console.log('[WS Hook] Conexão WebSocket estabelecida.');
        reconnectAttempts.current = 0; // Reset counter on successful connection
      };

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return;
        
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'arbitrage') {
            setOpportunities((prev) => [message, ...prev.slice(0, 99)]);
          }
          
          if (message.type === 'price-update') {
            const { symbol, marketType, bestAsk, bestBid } = message;
            setLivePrices(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                [marketType]: { bestAsk, bestBid }
              }
            }));
          }
        } catch (error) {
          console.error('[WS Hook] Erro ao processar mensagem do WebSocket:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WS Hook] Erro na conexão WebSocket:', error);
      };

      ws.current.onclose = (event) => {
        console.log(`[WS Hook] Conexão WebSocket fechada. Code: ${event.code}, Reason: ${event.reason}`);
        ws.current = null;
        
        if (isMounted.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[WS Hook] Tentando reconectar em ${RECONNECT_INTERVAL/1000} segundos... (Tentativa ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          reconnectTimeout.current = setTimeout(() => {
            if (isMounted.current) {
              connect();
            }
          }, RECONNECT_INTERVAL);
        }
      };
    } catch (error) {
      console.error('[WS Hook] Erro ao criar WebSocket:', error);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      reconnectAttempts.current = 0;
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
        ws.current = null;
      }
      
      console.log('[WS Hook] Limpeza da conexão WebSocket concluída.');
    };
  }, []);

  return { opportunities, livePrices, ws: ws.current };
} 