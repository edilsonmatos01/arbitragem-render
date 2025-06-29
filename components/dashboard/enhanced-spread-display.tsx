'use client';

import React, { useState, useEffect } from 'react';
import { useArbitrageWebSocket } from '@/components/arbitragem/useArbitrageWebSocket';
import { TrendingUp, TrendingDown, Activity, Zap, RefreshCw } from 'lucide-react';

interface SpreadData {
  symbol: string;
  spread: number;
  buyExchange: string;
  sellExchange: string;
  profit: number;
  timestamp: number;
  maxSpread24h?: number;
}

interface SpreadCardProps {
  data: SpreadData;
  isLive?: boolean;
}

function SpreadCard({ data, isLive = false }: SpreadCardProps) {
  const getSpreadColor = (spread: number) => {
    if (spread >= 1.0) return 'text-green-400';
    if (spread >= 0.5) return 'text-yellow-400';
    return 'text-custom-cyan';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-dark-bg p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-white">{data.symbol}</h3>
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <Zap className="h-3 w-3 text-green-400" />
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500">{formatTime(data.timestamp)}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Spread:</span>
          <span className={`font-semibold ${getSpreadColor(data.spread)}`}>
            {data.spread.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Lucro:</span>
          <span className={`font-semibold ${data.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.profit > 0 ? '+' : ''}${data.profit.toFixed(2)}
          </span>
        </div>
        
        <div className="pt-2 border-t border-gray-700">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Comprar: {data.buyExchange}</span>
            <span>Vender: {data.sellExchange}</span>
          </div>
        </div>
        
        {data.maxSpread24h && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Máx 24h:</span>
            <span className="text-yellow-400 font-semibold">
              {data.maxSpread24h.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EnhancedSpreadDisplay() {
  const { opportunities } = useArbitrageWebSocket();
  const [historicalSpreads, setHistoricalSpreads] = useState<SpreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Converter oportunidades do WebSocket para SpreadData
  const liveSpreadData: SpreadData[] = opportunities.slice(0, 6).map(opp => ({
    symbol: opp.baseSymbol,
    spread: opp.profitPercentage,
    buyExchange: opp.buyAt.exchange,
    sellExchange: opp.sellAt.exchange,
    profit: (opp.profitPercentage / 100) * 1000, // Estimativa baseada em $1000
    timestamp: opp.timestamp,
    maxSpread24h: opp.maxSpread24h
  }));

  const fetchHistoricalSpreads = async () => {
    try {
      setIsLoading(true);
      
      // Buscar spreads históricos dos principais símbolos
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT', 'DOT/USDT'];
      const promises = symbols.map(async (symbol) => {
        try {
          const response = await fetch(`/api/spread-history/24h/${encodeURIComponent(symbol)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              const latest = data[data.length - 1];
                             return {
                 symbol,
                 spread: latest.spread_percentage || 0,
                 buyExchange: 'Gate.io',
                 sellExchange: 'MEXC',
                 profit: (latest.spread_percentage || 0) / 100 * 1000,
                 timestamp: Date.now(),
                 maxSpread24h: Math.max(...data.map((d: any) => d.spread_percentage || 0)) || undefined
               };
            }
          }
        } catch (error) {
          console.error(`Erro ao buscar dados para ${symbol}:`, error);
        }
        return null;
      });

             const results = await Promise.all(promises);
       const validSpreads = results.filter(spread => spread !== null) as SpreadData[];
       
       setHistoricalSpreads(validSpreads);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar spreads históricos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalSpreads();
    
    // Atualizar dados históricos a cada 2 minutos
    const interval = setInterval(fetchHistoricalSpreads, 120000);
    return () => clearInterval(interval);
  }, []);

  const allSpreads = [...liveSpreadData, ...historicalSpreads];
  const uniqueSpreads = allSpreads.reduce((acc, current) => {
    const existing = acc.find(item => item.symbol === current.symbol);
    if (!existing || current.timestamp > existing.timestamp) {
      return [...acc.filter(item => item.symbol !== current.symbol), current];
    }
    return acc;
  }, [] as SpreadData[]);

  const displaySpreads = uniqueSpreads.slice(0, 6);

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Spreads em Tempo Real</h2>
          <p className="text-sm text-gray-400">
            Oportunidades de arbitragem detectadas
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {liveSpreadData.length > 0 && (
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">WebSocket Ativo</span>
            </div>
          )}
          
          <button
            onClick={fetchHistoricalSpreads}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {displaySpreads.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Aguardando dados de spread...</p>
          <p className="text-sm text-gray-500 mt-1">
            Conectando ao WebSocket e buscando dados históricos
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {displaySpreads.map((spread, index) => (
              <SpreadCard 
                key={`${spread.symbol}-${spread.timestamp}`} 
                data={spread}
                isLive={liveSpreadData.some(live => live.symbol === spread.symbol)}
              />
            ))}
          </div>
          
          {lastUpdate && (
            <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-700">
              Última atualização: {lastUpdate.toLocaleString('pt-BR')}
            </div>
          )}
        </>
      )}
    </div>
  );
} 