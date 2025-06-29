'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';

interface RealTimeMetrics {
  totalProfit: number;
  totalOperations: number;
  averageSpread: number;
  activePositions: number;
  isLoading: boolean;
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}

function MetricCard({ title, value, icon, trend = 'neutral', isLoading }: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-custom-cyan';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow min-h-[120px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400">{icon}</div>
        {getTrendIcon()}
      </div>
      <div>
        <h3 className="text-xs font-medium text-gray-400 mb-1 tracking-wider uppercase">{title}</h3>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-custom-cyan" />
            <span className="text-sm text-gray-400">Carregando...</span>
          </div>
        ) : (
          <p className={`text-2xl font-semibold ${getTrendColor()}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

export default function RealTimeMetrics() {
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    totalProfit: 0,
    totalOperations: 0,
    averageSpread: 0,
    activePositions: 0,
    isLoading: true
  });

  const fetchMetrics = async () => {
    try {
      setMetrics(prev => ({ ...prev, isLoading: true }));
      
      // Buscar dados paralelos das APIs
      const [operationsRes, positionsRes] = await Promise.all([
        fetch('/api/operation-history?filter=24h').catch(() => ({ json: () => [] })),
        fetch('/api/positions').catch(() => ({ json: () => [] }))
      ]);

      const operations = await operationsRes.json();
      const positions = await positionsRes.json();

      // Calcular métricas
      const totalProfit = Array.isArray(operations) 
        ? operations.reduce((sum: number, op: any) => sum + (op.profitLossUsd || 0), 0)
        : 0;

      const totalOperations = Array.isArray(operations) ? operations.length : 0;
      const activePositions = Array.isArray(positions) ? positions.length : 0;

      // Calcular spread médio das últimas operações
      const averageSpread = Array.isArray(operations) && operations.length > 0
        ? operations.reduce((sum: number, op: any) => sum + (op.profitLossPercent || 0), 0) / operations.length
        : 0.45; // Fallback

      setMetrics({
        totalProfit,
        totalOperations,
        averageSpread,
        activePositions,
        isLoading: false
      });

    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      setMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Lucro Total (24h)"
        value={`US$ ${metrics.totalProfit.toFixed(2)}`}
        icon={<DollarSign className="h-5 w-5" />}
        trend={metrics.totalProfit > 0 ? 'up' : metrics.totalProfit < 0 ? 'down' : 'neutral'}
        isLoading={metrics.isLoading}
      />
      
      <MetricCard
        title="Operações (24h)"
        value={metrics.totalOperations.toString()}
        icon={<Activity className="h-5 w-5" />}
        isLoading={metrics.isLoading}
      />
      
      <MetricCard
        title="Spread Médio"
        value={`${metrics.averageSpread.toFixed(2)}%`}
        icon={<TrendingUp className="h-5 w-5" />}
        isLoading={metrics.isLoading}
      />
      
      <MetricCard
        title="Posições Ativas"
        value={metrics.activePositions.toString()}
        icon={<Activity className="h-5 w-5" />}
        trend={metrics.activePositions > 0 ? 'up' : 'neutral'}
        isLoading={metrics.isLoading}
      />
    </div>
  );
} 