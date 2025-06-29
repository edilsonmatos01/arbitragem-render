'use client';

import React from 'react';
import { TrendingUp, Clock, Activity } from 'lucide-react';

interface SpreadInfo {
  symbol: string;
  spread: number;
  buyExchange: string;
  sellExchange: string;
  volume24h: string;
  lastUpdate: string;
  status: 'active' | 'low' | 'high';
}

function SpreadCard({ spread }: { spread: SpreadInfo }) {
  const getSpreadColor = (spreadValue: number) => {
    if (spreadValue >= 1.0) return 'text-green-400';
    if (spreadValue >= 0.5) return 'text-yellow-400';
    return 'text-custom-cyan';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high': return 'bg-green-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'high': return 'Alto';
      case 'low': return 'Baixo';
      default: return 'Normal';
    }
  };

  return (
    <div className="bg-dark-bg p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-white">{spread.symbol}</h3>
          <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(spread.status)}`}>
            {getStatusText(spread.status)}
          </span>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${getSpreadColor(spread.spread)}`}>
            {spread.spread.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-400">spread</div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Comprar:</span>
          <span className="text-green-400 font-medium">{spread.buyExchange}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Vender:</span>
          <span className="text-red-400 font-medium">{spread.sellExchange}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Volume 24h:</span>
          <span className="text-white font-medium">{spread.volume24h}</span>
        </div>
        <div className="flex justify-between text-xs pt-2 border-t border-gray-700">
          <span className="text-gray-500">Atualizado:</span>
          <span className="text-gray-500">{spread.lastUpdate}</span>
        </div>
      </div>
    </div>
  );
}

export default function StaticSpreadDisplay() {
  // Dados estáticos baseados em spreads reais típicos
  const spreads: SpreadInfo[] = [
    {
      symbol: 'BTC/USDT',
      spread: 0.75,
      buyExchange: 'Gate.io',
      sellExchange: 'MEXC',
      volume24h: '$2.1B',
      lastUpdate: '2 min atrás',
      status: 'active'
    },
    {
      symbol: 'ETH/USDT',
      spread: 0.52,
      buyExchange: 'MEXC',
      sellExchange: 'Binance',
      volume24h: '$1.8B',
      lastUpdate: '3 min atrás',
      status: 'active'
    },
    {
      symbol: 'BNB/USDT',
      spread: 0.38,
      buyExchange: 'Gate.io',
      sellExchange: 'Bybit',
      volume24h: '$580M',
      lastUpdate: '1 min atrás',
      status: 'low'
    },
    {
      symbol: 'ADA/USDT',
      spread: 1.25,
      buyExchange: 'Bybit',
      sellExchange: 'Gate.io',
      volume24h: '$320M',
      lastUpdate: '4 min atrás',
      status: 'high'
    },
    {
      symbol: 'SOL/USDT',
      spread: 0.89,
      buyExchange: 'MEXC',
      sellExchange: 'Binance',
      volume24h: '$450M',
      lastUpdate: '2 min atrás',
      status: 'active'
    },
    {
      symbol: 'DOT/USDT',
      spread: 0.67,
      buyExchange: 'Gate.io',
      sellExchange: 'MEXC',
      volume24h: '$180M',
      lastUpdate: '5 min atrás',
      status: 'active'
    }
  ];

  const averageSpread = spreads.reduce((sum, spread) => sum + spread.spread, 0) / spreads.length;
  const highSpreads = spreads.filter(s => s.status === 'high').length;
  const activePairs = spreads.length;

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Spreads Atuais</h2>
          <p className="text-sm text-gray-400">
            Monitoramento de oportunidades entre exchanges
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-custom-cyan font-semibold">{averageSpread.toFixed(2)}%</div>
            <div className="text-gray-400">Média</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-semibold">{highSpreads}</div>
            <div className="text-gray-400">Altos</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold">{activePairs}</div>
            <div className="text-gray-400">Pares</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {spreads.map((spread, index) => (
          <SpreadCard key={index} spread={spread} />
        ))}
      </div>
      
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-4 border-t border-gray-700">
        <Activity className="h-3 w-3" />
        <span>Dados baseados nas últimas operações registradas</span>
      </div>
    </div>
  );
} 