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

export function useArbitrageWebSocket() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  // Ref para rastrear se o componente está montado e evitar ações assíncronas
  // após o desmonte, especialmente útil no Strict Mode do React.
  const isMounted = useRef(false);

  const connect = () => {
    // Limpa qualquer timeout de reconexão pendente
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    // Previne novas conexões se já houver uma ou se o componente estiver desmontado.
    if (ws.current || !isMounted.current) return;

    ws.current = new WebSocket('ws://localhost:8888');
    console.log('[WS Hook] Tentando conectar ao servidor WebSocket...');

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

  return opportunities;
} 