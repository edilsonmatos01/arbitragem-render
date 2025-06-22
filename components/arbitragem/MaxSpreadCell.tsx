'use client';

import { useState, useEffect } from 'react';
import { LineChart as ChartIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import SpreadHistoryChart from './SpreadHistoryChart';
import PriceComparisonChart from './PriceComparisonChart';

interface MaxSpreadCellProps {
  symbol: string;
}

interface SpreadStats {
  spMax: number | null;
  crosses: number;
}

// Usamos um cache simples em memória para evitar chamadas repetidas à API para o mesmo símbolo.
const cache = new Map<string, { data: SpreadStats; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

export default function MaxSpreadCell({ symbol }: MaxSpreadCellProps) {
  const [stats, setStats] = useState<SpreadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartType, setChartType] = useState<'spread' | 'comparison'>('spread');

  useEffect(() => {
    const fetchStats = async () => {
      const cached = cache.get(symbol);
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
        setStats(cached.data);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/spreads/${encodeURIComponent(symbol)}/max`);
        if (!response.ok) {
          throw new Error('Falha ao buscar dados');
        }
        const data: SpreadStats = await response.json();
        
        // Se não houver dados suficientes, mostra N/D
        if (data.spMax === null || data.crosses < 2) {
          setStats({ spMax: null, crosses: data.crosses });
        } else {
          setStats(data);
        }
        
        cache.set(symbol, { data, timestamp: Date.now() });
      } catch (error) {
        console.error(`Erro ao buscar spread máximo para ${symbol}:`, error);
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [symbol]);

  // Reset chart type when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setChartType('spread');
    }
  }, [isModalOpen]);

  const getSpreadColor = (spread: number) => {
    if (spread > 2) return 'text-green-400';
    if (spread > 1) return 'text-yellow-400';
    return 'text-gray-400';
  };

  if (isLoading) {
    return <span className="text-gray-500">Carregando...</span>;
  }

  if (!stats || stats.spMax === null || stats.crosses < 2) {
    return <span className="text-gray-400">N/D</span>;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={`font-bold ${getSpreadColor(stats.spMax)}`}>
          {stats.spMax.toFixed(2)}%
        </span>
        <span className="text-xs text-gray-500">({stats.crosses} registros)</span>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <button className="ml-2 p-1 text-gray-400 hover:text-white transition-colors">
            <ChartIcon className="h-5 w-5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Análise de {symbol}</DialogTitle>
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setChartType('spread')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    chartType === 'spread'
                      ? 'bg-custom-cyan text-black font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Spread 24h
                </button>
                <button
                  onClick={() => setChartType('comparison')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    chartType === 'comparison'
                      ? 'bg-custom-cyan text-black font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Spot vs Futures
                </button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="mt-4">
            {/* Renderiza o gráfico apenas se o modal estiver aberto */}
            {isModalOpen && (
              <>
                {chartType === 'spread' ? (
                  <div>
                    <div className="mb-3 text-sm text-gray-400">
                      Histórico de spread máximo das últimas 24 horas
                    </div>
                    <SpreadHistoryChart symbol={symbol} />
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 text-sm text-gray-400">
                      Comparação de preços spot vs futures (pontos a cada 30 min)
                    </div>
                    <PriceComparisonChart symbol={symbol} />
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
