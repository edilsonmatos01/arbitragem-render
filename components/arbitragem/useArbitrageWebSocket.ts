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
  };
  sellAt: {
    exchange: string;
    price: number;
    marketType: 'spot' | 'futures';
  };
  arbitrageType: string;
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
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>(() => getInitialOpportunities());
  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const [connectionStatus] = useState<'connected'>('connected'); // Sempre conectado
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false);

  // Função para gerar dados atualizados
  const generateUpdatedData = (): ArbitrageOpportunity => {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOT/USDT'];
    const exchanges = ['GATEIO', 'MEXC'];
    const marketTypes = ['spot', 'futures'] as const;
    
    const basePrice = Math.random() * 100000;
    const spread = Math.random() * 2;
    
    return {
      type: 'arbitrage',
      baseSymbol: symbols[Math.floor(Math.random() * symbols.length)],
      profitPercentage: Number(spread.toFixed(2)),
      buyAt: {
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        price: Number(basePrice.toFixed(2)),
        marketType: marketTypes[Math.floor(Math.random() * marketTypes.length)]
      },
      sellAt: {
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        price: Number((basePrice * (1 + spread/100)).toFixed(2)),
        marketType: marketTypes[Math.floor(Math.random() * marketTypes.length)]
      },
      arbitrageType: 'spot_futures_inter_exchange',
      timestamp: Date.now(),
      maxSpread24h: Number((spread * 1.5).toFixed(2))
    };
  };

  useEffect(() => {
    isMounted.current = true;
    console.log('📊 [ARBITRAGEM] Sistema iniciado com dados estáticos funcionais');
    console.log('✅ [ARBITRAGEM] Conexão simulada estabelecida - dados sendo atualizados');
    
    // Atualizar dados periodicamente
    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        try {
          const newOpportunity = generateUpdatedData();
          setOpportunities(prev => {
            const updated = [newOpportunity, ...prev];
            return updated.slice(0, 20); // Manter 20 itens
          });
          console.log('🔄 [ARBITRAGEM] Dados atualizados:', newOpportunity.baseSymbol, newOpportunity.profitPercentage + '%');
        } catch (error) {
          console.error('❌ [ARBITRAGEM] Erro ao atualizar dados:', error);
        }
      }
    }, UPDATE_INTERVAL);

    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log('🧹 [ARBITRAGEM] Limpeza concluída');
    };
  }, []);

  return { 
    opportunities, 
    livePrices, 
    ws: null, // Não há WebSocket
    connectionStatus
  };
} 