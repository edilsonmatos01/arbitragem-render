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
  // Ref para rastrear se o componente está montado e evitar ações assíncronas
  // após o desmonte, especialmente útil no Strict Mode do React.
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    // A URL agora é lida da variável de ambiente, que é definida no processo de build.
    const wsURL = process.env.NEXT_PUBLIC_WS_URL;

    if (!wsURL) {
      console.error("A variável de ambiente NEXT_PUBLIC_WS_URL não está definida!");
      // Em desenvolvimento, podemos ter um fallback para a configuração antiga
      if (process.env.NODE_ENV === 'development') {
        if (typeof window === 'undefined') return '';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}`;
      }
      return '';
    }
    return wsURL;
  };

  const connect = () => {
    // Limpa qualquer timeout de reconexão pendente
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    // Previne novas conexões se já houver uma ou se o componente estiver desmontado.
    if (ws.current || !isMounted.current) return;

    const wsURL = getWebSocketURL();
    if (!wsURL) return; // Não tenta conectar se não houver URL (SSR)

    ws.current = new WebSocket(wsURL);
    console.log(`[WS Hook] Tentando conectar ao servidor WebSocket em ${wsURL}...`);

    ws.current.onopen = () => {
      console.log('[WS Hook] Conexão WebSocket estabelecida.');
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
      // O evento 'onclose' será disparado em seguida para tratar a reconexão.
    };

    ws.current.onclose = () => {
      console.log('[WS Hook] Conexão WebSocket fechada.');
      // Só tenta reconectar se o componente ainda estiver montado.
      if (isMounted.current) {
        console.log('[WS Hook] Tentando reconectar em 5 segundos...');
        ws.current = null; // Limpa a instância antiga do socket.
        reconnectTimeout.current = setTimeout(connect, 5000);
      }
    };
  };

  useEffect(() => {
    isMounted.current = true;
    connect();

    // A função de cleanup é executada quando o componente é desmontado.
    return () => {
      isMounted.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        // Fechar a conexão não acionará mais a reconexão devido à verificação isMounted.current.
        ws.current.close(); 
        console.log('[WS Hook] Limpeza da conexão WebSocket concluída.');
      }
    };
  }, []);

  return { opportunities, livePrices, ws: ws.current };
} 