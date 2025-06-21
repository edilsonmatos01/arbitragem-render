import { useState, useEffect, useCallback } from 'react';

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

function getWebSocketUrl() {
  // Em produção, use o protocolo wss:// se a página estiver em https://
  const isSecure = window.location.protocol === 'https:';
  const wsProtocol = isSecure ? 'wss:' : 'ws:';
  
  // Use a mesma origem do site em produção
  if (process.env.NODE_ENV === 'production') {
    const host = window.location.host;
    // Se estiver no domínio principal, conecte ao subdomínio do tracker
    if (host.includes('robo-de-arbitragem')) {
      return 'wss://robo-de-arbitragem-tracker.onrender.com';
    }
    // Caso contrário, use o mesmo host
    return `${wsProtocol}//${host}`;
  }
  
  // Em desenvolvimento, use localhost:3001
  return 'ws://localhost:3001';
}

export function useArbitrageWebSocket() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();
      console.log('Conectando ao WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket conectado com sucesso');
        setIsConnected(true);
        setError(null);
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
        } catch (err) {
          console.error('Erro ao processar mensagem:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket desconectado, código:', event.code, 'razão:', event.reason);
        setIsConnected(false);
        setTimeout(connect, 5000); // Tentar reconectar após 5 segundos
      };

      ws.onerror = (err) => {
        setError('Erro na conexão WebSocket');
        console.error('Erro WebSocket:', err);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (err) {
      setError('Erro ao conectar ao WebSocket');
      console.error('Erro ao criar WebSocket:', err);
    }
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);

  return {
    opportunities,
    livePrices,
    isConnected,
    error
  };
} 