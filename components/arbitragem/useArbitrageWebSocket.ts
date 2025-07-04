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
  arbitrageType: string; // Mudado para string genérico para aceitar 'spot_to_futures'
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

export function useArbitrageWebSocket(enabled = true) {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  // Ref para rastrear se o componente está montado e evitar ações assíncronas
  // após o desmonte, especialmente útil no Strict Mode do React.
  const isMounted = useRef(false);

  const getWebSocketURL = () => {
    // A URL agora é lida da variável de ambiente, que é definida no processo de build.
    const wsURL = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

    console.log('[WS Hook] Variável de ambiente NEXT_PUBLIC_WEBSOCKET_URL:', wsURL);
    console.log('[WS Hook] NODE_ENV:', process.env.NODE_ENV);

    if (!wsURL) {
      console.error("A variável de ambiente NEXT_PUBLIC_WEBSOCKET_URL não está definida!");
      // Em desenvolvimento, podemos ter um fallback para a configuração antiga
      if (process.env.NODE_ENV === 'development') {
        if (typeof window === 'undefined') return '';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const fallbackURL = `${protocol}//${host}`;
        console.log('[WS Hook] Usando URL de fallback para desenvolvimento:', fallbackURL);
        return fallbackURL;
      }
      return '';
    }

    console.log('[WS Hook] Usando URL da variável de ambiente:', wsURL);
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
        console.log('[DEBUG] Mensagem WebSocket recebida:', message);
        console.log('[DEBUG] Tipo da mensagem:', message.type);
        
        if (message.type === 'arbitrage') {
          console.log('[DEBUG] ✅ Oportunidade de arbitragem recebida:', message);
          console.log('[DEBUG] baseSymbol:', message.baseSymbol);
          console.log('[DEBUG] profitPercentage:', message.profitPercentage);
          console.log('[DEBUG] arbitrageType:', message.arbitrageType);
          console.log('[DEBUG] buyAt:', message.buyAt);
          console.log('[DEBUG] sellAt:', message.sellAt);
          
          setOpportunities((prev) => {
            console.log('[DEBUG] Adicionando oportunidade ao estado. Estado anterior:', prev.length);
            // Remove oportunidades antigas do mesmo par
            const filtered = prev.filter(p => 
              p.baseSymbol !== message.baseSymbol || 
              p.arbitrageType !== message.arbitrageType
            );
            const newState = [message, ...filtered].slice(0, 99);
            console.log('[DEBUG] Novo estado de oportunidades:', newState.length);
            return newState;
          });
        }
        else if (message.type === 'price-update') {
          const { symbol, marketType, bestAsk, bestBid } = message;
          console.log(`[DEBUG] Atualização de preço recebida para ${symbol} (${marketType}):`, { bestAsk, bestBid });
          setLivePrices(prev => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              [marketType]: { bestAsk, bestBid }
            }
          }));
        }
        else {
          console.log('[DEBUG] ⚠️ Tipo de mensagem não reconhecido:', message.type);
        }
      } catch (error) {
        console.error('[WS Hook] Erro ao processar mensagem do WebSocket:', error);
        console.error('[WS Hook] Mensagem que causou o erro:', event.data);
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
    if (enabled) {
      connect();
    }
    // A função de cleanup é executada quando o componente é desmontado ou enabled muda para false.
    return () => {
      isMounted.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
        ws.current = null;
        console.log('[WS Hook] Limpeza da conexão WebSocket concluída.');
      }
    };
  }, [enabled]);

  return { opportunities, livePrices };
} 