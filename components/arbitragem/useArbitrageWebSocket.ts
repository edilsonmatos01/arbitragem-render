import { useState, useEffect, useCallback, useRef } from 'react';

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

export function useArbitrageWebSocket() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';
    
    if (process.env.NODE_ENV === 'production') {
      return 'wss://robo-de-arbitragem-tracker.onrender.com:10000';
    }
    
    return 'ws://localhost:10000';
  }, []);

  const checkServerHealth = useCallback(async () => {
    if (!isConnected) return;

    try {
      const wsUrl = getWebSocketUrl();
      const httpUrl = wsUrl.replace('ws:', 'https:').replace('wss:', 'https:');
      const response = await fetch(`${httpUrl}/health`);
      
      if (!response.ok) {
        throw new Error('Servidor não está saudável');
      }

      const data = await response.json();
      console.log('Health check:', data);
    } catch (error) {
      console.error('Erro no health check:', error);
      reconnect();
    }
  }, [isConnected, getWebSocketUrl]);

  const reconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      setError('Número máximo de tentativas de reconexão atingido');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current += 1;
      console.log(`Tentativa de reconexão ${reconnectAttempts.current} de ${MAX_RECONNECT_ATTEMPTS}`);
      connect();
    }, RECONNECT_INTERVAL);
  }, []);

  const connect = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket já está conectado');
        return;
      }

      const wsUrl = getWebSocketUrl();
      console.log('Conectando ao WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado com sucesso');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'arbitrage') {
            console.log('Recebida oportunidade de arbitragem:', data);
            setOpportunities((prev) => [...prev, {
              ...data,
              timestamp: new Date(data.timestamp)
            }].slice(-100)); // Manter apenas as últimas 100 oportunidades
          }
          if (data.type === 'price-update') {
            const { symbol, marketType, bestAsk, bestBid } = data;
            setLivePrices(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                [marketType]: { bestAsk, bestBid }
              }
            }));
          }
          if (data.type === 'full_book') {
            console.log('Recebido book completo:', data);
            setLivePrices(data.data);
          }
        } catch (err) {
          console.error('Erro ao processar mensagem:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket desconectado, código:', event.code, 'razão:', event.reason);
        setIsConnected(false);
        
        // Códigos específicos que indicam que não devemos tentar reconectar
        const terminalCodes = [1000, 1001]; // Normal closure, Going away
        if (!terminalCodes.includes(event.code)) {
          reconnect();
        }
      };

      ws.onerror = (err) => {
        setError('Erro na conexão WebSocket');
        console.error('Erro WebSocket:', err);
      };

      // Inicia o health check
      const healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);

      return () => {
        clearInterval(healthCheckInterval);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Fechamento normal');
        }
      };
    } catch (err) {
      setError('Erro ao conectar ao WebSocket');
      console.error('Erro ao criar WebSocket:', err);
      reconnect();
    }
  }, [getWebSocketUrl, reconnect, checkServerHealth]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Componente desmontado');
      }
    };
  }, [connect]);

  return {
    opportunities,
    livePrices,
    isConnected,
    error,
    reconnect: () => {
      reconnectAttempts.current = 0;
      connect();
    }
  };
} 