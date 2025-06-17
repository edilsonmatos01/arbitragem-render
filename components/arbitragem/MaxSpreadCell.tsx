'use client';

import React, { useState, useEffect } from 'react';
import { LineChart as ChartIcon, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
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

// Cache para evitar chamadas repetidas à API
const cache = new Map<string, { data: SpreadStats; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

export default function MaxSpreadCell({ symbol }: MaxSpreadCellProps) {
  const [stats, setStats] = useState<SpreadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartType, setChartType] = useState<'spread' | 'price'>('spread');

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

  const handleOpenChange = (open: boolean) => {
    // Só permite fechar o modal através do botão X
    if (open) {
      setIsModalOpen(true);
    }
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
        <span className={`font-bold ${stats.spMax > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
          {stats.spMax.toFixed(2)}%
        </span>
        <span className="text-xs text-gray-500">({stats.crosses} registros)</span>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button className="ml-2 p-1 text-gray-400 hover:text-white transition-colors">
            <ChartIcon className="h-5 w-5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl bg-dark-card border-gray-700 text-white">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle>Análise de {symbol}</DialogTitle>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setChartType('spread')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    chartType === 'spread'
                      ? 'bg-green-500 text-white font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Spread (%)
                </button>
                <button
                  onClick={() => setChartType('price')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    chartType === 'price'
                      ? 'bg-green-500 text-white font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Preços Spot/Future
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 h-[400px]">
            {isModalOpen && (
              chartType === 'spread' ? (
                <SpreadHistoryChart symbol={symbol} />
              ) : (
                <PriceComparisonChart symbol={symbol} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 