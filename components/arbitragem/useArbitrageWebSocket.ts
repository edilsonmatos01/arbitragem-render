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
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    if (typeof window === 'undefined') return '';

    // Em desenvolvimento, conectar ao servidor Next.js na porta 3000
    if (window.location.hostname === 'localhost') {
      const wsURL = 'ws://localhost:3000';
      console.log(`🔗 [WebSocket] Conectando LOCAL: ${wsURL}`);
      return wsURL;
    }

    // Em produção no Render, usar a URL da aplicação atual
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsURL = `${protocol}//${host}`;
    
    console.log(`🔗 [WebSocket] Conectando PRODUÇÃO: ${wsURL}`);
    return wsURL;
  };

  const connect = () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    if (ws.current?.readyState === WebSocket.OPEN || !isMounted.current) return;
    
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('❌ [WebSocket] Limite de tentativas atingido - usando dados de fallback');
      return;
    }

    const wsURL = getWebSocketURL();
    if (!wsURL) {
      console.error('❌ [WebSocket] URL não disponível');
      return;
    }

    try {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      ws.current = new WebSocket(wsURL);
      console.log(`🚀 [WebSocket] Tentativa ${reconnectAttempts.current + 1}/${maxReconnectAttempts} - Conectando...`);

      ws.current.onopen = () => {
        console.log('✅ [WebSocket] Conectado! Aguardando dados REAIS das exchanges...');
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return;
        
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'arbitrage') {
            console.log(`📊 [WebSocket] Oportunidade REAL recebida: ${message.baseSymbol} - ${message.profitPercentage.toFixed(2)}%`);
            
            // Adiciona timestamp se não existir
            const opportunityWithTimestamp = {
              ...message,
              timestamp: message.timestamp || Date.now()
            };
            
            setOpportunities(prev => {
              // Remove oportunidades antigas do mesmo símbolo para evitar duplicatas
              const filtered = prev.filter(opp => opp.baseSymbol !== message.baseSymbol);
              return [opportunityWithTimestamp, ...filtered].slice(0, 50); // Mantém 50 oportunidades
            });
          }
          
          if (message.type === 'price-update') {
            const { symbol, marketType, bestAsk, bestBid } = message;
            console.log(`💰 [WebSocket] Preço atualizado: ${symbol} ${marketType} - Ask: ${bestAsk}, Bid: ${bestBid}`);
            
            setLivePrices(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                [marketType]: { bestAsk, bestBid }
              }
            }));
          }

          if (message.type === 'connection') {
            console.log('🤝 [WebSocket] Mensagem de boas-vindas:', message.message);
          }
          
        } catch (error) {
          console.error('❌ [WebSocket] Erro ao processar mensagem:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ [WebSocket] Erro de conexão:', error);
      };

      ws.current.onclose = (event) => {
        console.log(`🔌 [WebSocket] Conexão fechada - Código: ${event.code}`);
        ws.current = null;
        
        if (isMounted.current && event.code !== 1000) {
          reconnectAttempts.current++;
          const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts.current), 30000);
          console.log(`🔄 [WebSocket] Reconectando em ${delay/1000}s... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };
      
    } catch (error) {
      console.error('❌ [WebSocket] Erro ao criar conexão:', error);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    console.log('🚀 [WebSocket] Iniciando sistema de dados REAIS...');
    console.log('📡 [WebSocket] Conectando com Gate.io e MEXC para oportunidades reais...');
    
    connect();

    return () => {
      console.log('🧹 [WebSocket] Limpando conexões...');
      isMounted.current = false;
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounted');
      }
    };
  }, []);

  return { 
    opportunities, 
    livePrices, 
    ws: ws.current 
  };
} 