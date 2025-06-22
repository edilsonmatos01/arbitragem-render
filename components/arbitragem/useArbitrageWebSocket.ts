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

const UPDATE_INTERVAL = 10000; // 10 segundos

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

// Dados estáticos iniciais que sempre funcionam
const getInitialOpportunities = (): ArbitrageOpportunity[] => [
  {
    type: 'arbitrage',
    baseSymbol: 'BTC/USDT',
    profitPercentage: 0.85,
    buyAt: {
      exchange: 'GATEIO',
      price: 97250.50,
      marketType: 'spot'
    },
    sellAt: {
      exchange: 'MEXC',
      price: 98075.25,
      marketType: 'futures'
    },
    arbitrageType: 'spot_futures_inter_exchange',
    timestamp: Date.now(),
    maxSpread24h: 1.2
  },
  {
    type: 'arbitrage',
    baseSymbol: 'ETH/USDT',
    profitPercentage: 0.45,
    buyAt: {
      exchange: 'MEXC',
      price: 3425.80,
      marketType: 'spot'
    },
    sellAt: {
      exchange: 'GATEIO',
      price: 3441.25,
      marketType: 'futures'
    },
    arbitrageType: 'spot_futures_inter_exchange',
    timestamp: Date.now(),
    maxSpread24h: 0.8
  },
  {
    type: 'arbitrage',
    baseSymbol: 'SOL/USDT',
    profitPercentage: 1.25,
    buyAt: {
      exchange: 'GATEIO',
      price: 185.40,
      marketType: 'futures'
    },
    sellAt: {
      exchange: 'MEXC',
      price: 187.72,
      marketType: 'spot'
    },
    arbitrageType: 'futures_spot_inter_exchange',
    timestamp: Date.now(),
    maxSpread24h: 1.8
  },
  {
    type: 'arbitrage',
    baseSymbol: 'BNB/USDT',
    profitPercentage: 0.65,
    buyAt: {
      exchange: 'MEXC',
      price: 715.20,
      marketType: 'futures'
    },
    sellAt: {
      exchange: 'GATEIO',
      price: 719.85,
      marketType: 'spot'
    },
    arbitrageType: 'futures_spot_inter_exchange',
    timestamp: Date.now(),
    maxSpread24h: 1.1
  },
  {
    type: 'arbitrage',
    baseSymbol: 'XRP/USDT',
    profitPercentage: 0.35,
    buyAt: {
      exchange: 'GATEIO',
      price: 2.485,
      marketType: 'spot'
    },
    sellAt: {
      exchange: 'MEXC',
      price: 2.494,
      marketType: 'futures'
    },
    arbitrageType: 'spot_futures_inter_exchange',
    timestamp: Date.now(),
    maxSpread24h: 0.7
  }
];

export function useArbitrageWebSocket() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // Ref para rastrear se o componente está montado e evitar ações assíncronas
  // após o desmonte, especialmente útil no Strict Mode do React.
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    // Verifica se está no lado do cliente
    if (typeof window === 'undefined') return '';

    // Tenta pegar da variável de ambiente primeiro
    let wsURL = process.env.NEXT_PUBLIC_WS_URL;
    
    if (!wsURL) {
      // Fallback: detecta automaticamente baseado na URL atual
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsURL = `${protocol}//${host}`;
      console.log(`[WS Hook] Variável NEXT_PUBLIC_WS_URL não definida. Usando fallback: ${wsURL}`);
    }

    console.log(`[WS Hook] URL do WebSocket: ${wsURL}`);
    return wsURL;
  };

  const connect = () => {
    // Limpa qualquer timeout de reconexão pendente
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    // Previne novas conexões se já houver uma ou se o componente estiver desmontado.
    if (ws.current?.readyState === WebSocket.OPEN || !isMounted.current) return;
    
    // Verifica se atingiu o limite de tentativas
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('[WS Hook] Limite de tentativas de reconexão atingido');
      return;
    }

    const wsURL = getWebSocketURL();
    if (!wsURL) {
      console.error('[WS Hook] URL do WebSocket não disponível');
      return;
    }

    try {
      // Fecha conexão anterior se existir
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      ws.current = new WebSocket(wsURL);
      console.log(`[WS Hook] Tentativa ${reconnectAttempts.current + 1} - Conectando ao WebSocket: ${wsURL}`);

      ws.current.onopen = () => {
        console.log('[WS Hook] ✅ Conexão WebSocket estabelecida com sucesso!');
        reconnectAttempts.current = 0; // Reset contador em caso de sucesso
      };

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'arbitrage') {
            console.log('[WS Hook] 📊 Nova oportunidade recebida:', message.baseSymbol);
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
          console.error('[WS Hook] ❌ Erro ao processar mensagem:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WS Hook] ❌ Erro na conexão WebSocket:', error);
      };

      ws.current.onclose = (event) => {
        console.log(`[WS Hook] 🔌 Conexão WebSocket fechada. Código: ${event.code}, Razão: ${event.reason}`);
        ws.current = null;
        
        // Só tenta reconectar se o componente ainda estiver montado e não foi fechamento intencional
        if (isMounted.current && event.code !== 1000) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Backoff exponencial
          console.log(`[WS Hook] 🔄 Tentando reconectar em ${delay/1000}s... (Tentativa ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };
    } catch (error) {
      console.error('[WS Hook] ❌ Erro ao criar WebSocket:', error);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    console.log('[WS Hook] 🚀 Iniciando sistema WebSocket...');
    connect();

    // A função de cleanup é executada quando o componente é desmontado.
    return () => {
      console.log('[WS Hook] 🧹 Limpando conexões WebSocket...');
      isMounted.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        // Fechar a conexão não acionará mais a reconexão devido à verificação isMounted.current.
        ws.current.close(1000, 'Component unmounted'); 
      }
    };
  }, []);

  return { opportunities, livePrices, ws: ws.current };
} 