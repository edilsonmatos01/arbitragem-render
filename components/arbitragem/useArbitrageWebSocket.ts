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
const MAX_RECONNECT_ATTEMPTS = 3; // Reduzido para 3 tentativas
const HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
const FALLBACK_POLLING_INTERVAL = 15000; // 15 segundos para polling HTTP

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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'fallback'>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const fallbackInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    console.log('[DEBUG] ========== CONSTRUÇÃO URL WEBSOCKET ==========');
    console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[DEBUG] typeof window:', typeof window);
    
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] window.location.href:', window.location.href);
      console.log('[DEBUG] window.location.protocol:', window.location.protocol);
      console.log('[DEBUG] window.location.host:', window.location.host);
      console.log('[DEBUG] window.location.hostname:', window.location.hostname);
      console.log('[DEBUG] window.location.port:', window.location.port);
    }
    
    // Em desenvolvimento, sempre usar URL local
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] ⚠️ USANDO URL DE DESENVOLVIMENTO');
      return 'ws://localhost:10000';
    }
    
    // Em produção, usar a mesma URL do Next.js com protocolo WebSocket
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;
      console.log('[DEBUG] ✅ CONSTRUINDO URL DINÂMICA:');
      console.log('[DEBUG] - protocol:', protocol);
      console.log('[DEBUG] - host:', host);
      console.log('[DEBUG] - wsUrl FINAL:', wsUrl);
      return wsUrl;
    }
    
    // Fallback para a URL específica do Render
    console.log('[DEBUG] ⚠️ USANDO URL DE FALLBACK');
    return 'wss://robo-de-arbitragem-5n8k.onrender.com';
  };

  // Função para gerar dados mock quando WebSocket falha
  const generateMockData = (): ArbitrageOpportunity => {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
    const exchanges = ['GATEIO', 'MEXC'];
    const marketTypes: ('spot' | 'futures')[] = ['spot', 'futures'];
    
    return {
      type: 'arbitrage',
      baseSymbol: symbols[Math.floor(Math.random() * symbols.length)],
      profitPercentage: parseFloat((Math.random() * 2).toFixed(2)),
      buyAt: {
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        price: parseFloat((Math.random() * 100000).toFixed(2)),
        marketType: marketTypes[Math.floor(Math.random() * marketTypes.length)]
      },
      sellAt: {
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        price: parseFloat((Math.random() * 100000).toFixed(2)),
        marketType: marketTypes[Math.floor(Math.random() * marketTypes.length)]
      },
      arbitrageType: 'spot_futures_inter_exchange',
      timestamp: Date.now(),
      maxSpread24h: parseFloat((Math.random() * 3).toFixed(2))
    };
  };

  // Fallback com dados simulados
  const startFallbackMode = () => {
    console.log('🔄 [FALLBACK] Iniciando modo fallback com dados simulados');
    setConnectionStatus('fallback');
    
    // Adicionar dados iniciais
    const initialData = Array.from({ length: 5 }, () => generateMockData());
    setOpportunities(initialData);
    
    // Continuar enviando dados periodicamente
    if (fallbackInterval.current) {
      clearInterval(fallbackInterval.current);
    }
    
    fallbackInterval.current = setInterval(() => {
      if (isMounted.current) {
        const newOpportunity = generateMockData();
        setOpportunities(prev => [newOpportunity, ...prev.slice(0, 99)]);
        console.log('📊 [FALLBACK] Dados simulados atualizados:', newOpportunity.baseSymbol);
      }
    }, FALLBACK_POLLING_INTERVAL);
  };

  const connect = () => {
    if (ws.current?.readyState === WebSocket.CONNECTING || 
        ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WS Hook] Máximo de tentativas de reconexão atingido - iniciando fallback');
      startFallbackMode();
      return;
    }

    const wsURL = getWebSocketURL();
    console.log(`[WS Hook] Tentando conectar ao servidor WebSocket em ${wsURL}... (Tentativa ${reconnectAttempts.current + 1})`);
    setConnectionStatus('connecting');
    
    try {
      ws.current = new WebSocket(wsURL);

      ws.current.onopen = () => {
        console.log('[WS Hook] ✅ Conexão WebSocket estabelecida.');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0; // Reset counter on successful connection
        
        // Limpar fallback se estava ativo
        if (fallbackInterval.current) {
          clearInterval(fallbackInterval.current);
          fallbackInterval.current = null;
        }
      };

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return;
        
        try {
          const message = JSON.parse(event.data);
          console.log('[WS Hook] 📨 Mensagem recebida:', message);
          
          if (message.type === 'arbitrage') {
            setOpportunities((prev) => [message, ...prev.slice(0, 99)]);
          }
          
          if (message.type === 'connection') {
            console.log('[WS Hook] 🎉 Confirmação de conexão:', message.message);
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
        console.error('[WS Hook] ❌ Erro na conexão WebSocket:', error);
        setConnectionStatus('disconnected');
      };

      ws.current.onclose = (event) => {
        console.log(`[WS Hook] ❌ Conexão WebSocket fechada. Code: ${event.code}, Reason: ${event.reason}`);
        setConnectionStatus('disconnected');
        ws.current = null;
        
        if (isMounted.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[WS Hook] 🔄 Tentando reconectar em ${RECONNECT_INTERVAL/1000} segundos... (Tentativa ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          reconnectTimeout.current = setTimeout(() => {
            if (isMounted.current) {
              connect();
            }
          }, RECONNECT_INTERVAL);
        } else if (isMounted.current) {
          startFallbackMode();
        }
      };
    } catch (error) {
      console.error('[WS Hook] ❌ Erro ao criar WebSocket:', error);
      setConnectionStatus('disconnected');
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        startFallbackMode();
      }
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
      
      if (fallbackInterval.current) {
        clearInterval(fallbackInterval.current);
        fallbackInterval.current = null;
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
        ws.current = null;
      }
      
      console.log('[WS Hook] 🧹 Limpeza da conexão WebSocket concluída.');
    };
  }, []);

  return { 
    opportunities, 
    livePrices, 
    ws: ws.current,
    connectionStatus // Expor status da conexão
  };
} 