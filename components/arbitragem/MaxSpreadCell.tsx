'use client';

import { useState, useEffect } from 'react';

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
    <div className="flex flex-col">
      <span className="font-bold text-green-400">{stats.spMax.toFixed(4)}%</span>
      <span className="text-xs text-gray-500">({stats.crosses} ocorrências)</span>
    </div>
  );
} 