'use client';

import React, { useState, useEffect } from 'react';
import { useArbitrageWebSocket } from '@/components/arbitragem/useArbitrageWebSocket';
import { TrendingUp, Star, Clock, ArrowRight, Zap } from 'lucide-react';

interface Opportunity {
  symbol: string;
  spread: number;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  estimatedProfit: number;
  timestamp: number;
  isLive: boolean;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  rank: number;
}

function OpportunityCard({ opportunity, rank }: OpportunityCardProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 2: return 'text-gray-300 bg-gray-300/10 border-gray-300/20';
      case 3: return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-custom-cyan bg-custom-cyan/10 border-custom-cyan/20';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 1) return `${seconds}s atrás`;
    if (minutes < 60) return `${minutes}m atrás`;
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-dark-bg p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-all hover:shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${getRankColor(rank)}`}>
            {rank <= 3 ? <Star className="h-4 w-4" /> : rank}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{opportunity.symbol}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              <span>{formatTime(opportunity.timestamp)}</span>
              {opportunity.isLive && (
                <div className="flex items-center gap-1 text-green-400">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            {opportunity.spread.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-400">spread</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg">
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400 mb-1">Comprar em</div>
            <div className="font-semibold text-green-400">{opportunity.buyExchange}</div>
            <div className="text-xs text-gray-500">${opportunity.buyPrice.toFixed(4)}</div>
          </div>
          
          <div className="px-3">
            <ArrowRight className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="text-center flex-1">
            <div className="text-sm text-gray-400 mb-1">Vender em</div>
            <div className="font-semibold text-red-400">{opportunity.sellExchange}</div>
            <div className="text-xs text-gray-500">${opportunity.sellPrice.toFixed(4)}</div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm text-gray-400">Lucro estimado:</span>
          <span className="font-semibold text-custom-cyan">
            +${opportunity.estimatedProfit.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TopOpportunities() {
  const { opportunities } = useArbitrageWebSocket();
  const [topOpportunities, setTopOpportunities] = useState<Opportunity[]>([]);

  useEffect(() => {
    // Converter e ordenar oportunidades do WebSocket
    const convertedOpportunities: Opportunity[] = opportunities
      .slice(0, 5) // Top 5 oportunidades
      .map(opp => ({
        symbol: opp.baseSymbol,
        spread: opp.profitPercentage,
        buyExchange: opp.buyAt.exchange,
        sellExchange: opp.sellAt.exchange,
        buyPrice: opp.buyAt.price,
        sellPrice: opp.sellAt.price,
        estimatedProfit: (opp.profitPercentage / 100) * 1000, // Baseado em $1000
        timestamp: opp.timestamp,
        isLive: true
      }))
      .sort((a, b) => b.spread - a.spread); // Ordenar por spread (maior primeiro)

    setTopOpportunities(convertedOpportunities);
  }, [opportunities]);

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-custom-cyan" />
          <h2 className="text-xl font-semibold text-white">Top Oportunidades</h2>
        </div>
        
        {opportunities.length > 0 && (
          <div className="flex items-center gap-2 text-green-400">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">
              {opportunities.length} oportunidades ativas
            </span>
          </div>
        )}
      </div>

      {topOpportunities.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            Aguardando Oportunidades
          </h3>
          <p className="text-gray-500 mb-4">
            Monitorando spreads em tempo real...
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-custom-cyan rounded-full animate-pulse"></div>
            <span>Sistema ativo</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {topOpportunities.map((opportunity, index) => (
            <OpportunityCard
              key={`${opportunity.symbol}-${opportunity.timestamp}`}
              opportunity={opportunity}
              rank={index + 1}
            />
          ))}
          
          <div className="text-center pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Atualizado em tempo real via WebSocket
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 