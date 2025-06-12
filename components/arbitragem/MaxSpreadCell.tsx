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
import SpreadHistoryChart from './SpreadHistoryChart'; // Importando o componente do gráfico

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

  useEffect(() => {
    const fetchStats = async () => {
      // Verifica o cache primeiro
      const cached = cache.get(symbol);
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
        setStats(cached.data);
        setIsLoading(false);
        return;
      }

      // Se não estiver no cache ou o cache estiver expirado, busca na API
      setIsLoading(true);
      try {
        const response = await fetch(`/api/spreads/${encodeURIComponent(symbol)}/max`);
        if (!response.ok) {
          throw new Error('Falha ao buscar dados');
        }
        const data: SpreadStats = await response.json();
        setStats(data);
        // Armazena no cache
        cache.set(symbol, { data, timestamp: Date.now() });
      } catch (error) {
        console.error(`Erro ao buscar spread máximo para ${symbol}:`, error);
        setStats(null); // Limpa em caso de erro
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [symbol]); // O efeito é re-executado se o símbolo mudar

  if (isLoading) {
    return <span className="text-gray-500">Carregando...</span>;
  }

  if (!stats || stats.spMax === null) {
    return <span className="text-gray-400">N/A</span>;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="font-bold text-green-400">{stats.spMax.toFixed(2)}%</span>
        <span className="text-xs text-gray-500">({stats.crosses} ocorrências)</span>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <button className="ml-2 p-1 text-gray-400 hover:text-white transition-colors">
            <ChartIcon className="h-5 w-5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Histórico de Spread para {symbol}</DialogTitle>
          </DialogHeader>
          {/* Renderiza o gráfico apenas se o modal estiver aberto */}
          {isModalOpen && <SpreadHistoryChart symbol={symbol} />}
        </DialogContent>
      </Dialog>
    </div>
  );
} 