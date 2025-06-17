'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface PriceComparisonChartProps {
  symbol: string;
}

interface PriceData {
  timestamp: string;
  gateio_price: number | null;
  mexc_price: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | null;
    dataKey: string;
    name: string;
  }>;
  label?: string;
}

// Constante para o intervalo de atualização (30 minutos)
const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

function formatBrasiliaTime(date: Date): string {
  return new Date(date).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDateTime(timestamp: string) {
  const [date, time] = timestamp.split(' - ');
  const [day, month] = date.split('/');
  return `${day}/${month} ${time}`;
}

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/price-comparison/${encodeURIComponent(symbol)}`);
      if (!response.ok) throw new Error('Falha ao carregar dados');
      const result = await response.json();
      setData(result);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erro ao buscar dados de preços:', err);
      setError('Falha ao carregar dados de preços');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-2 rounded-md shadow-lg">
          <p className="text-white">{`Data: ${formatDateTime(label || '')}`}</p>
          <p className="text-green-400">{`Gate.io (spot): ${payload[0]?.value?.toFixed(8) || 'N/D'}`}</p>
          <p className="text-gray-400">{`MEXC (futures): ${payload[1]?.value?.toFixed(8) || 'N/D'}`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-gray-400">Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  // Encontra os valores mínimo e máximo para ajustar a escala do eixo Y
  const allPrices = data.flatMap(d => [d.gateio_price, d.mexc_price].filter(p => p !== null) as number[]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1; // 10% de padding

  return (
    <div className="w-full h-[400px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          Comparativo de Preços - {symbol}
        </h3>
        {lastUpdate && (
          <span className="text-sm text-gray-400">
            Atualizado: {formatDateTime(lastUpdate.toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).replace(', ', ' - '))}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={2}
            tickFormatter={formatDateTime}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value) => value.toFixed(8)}
            domain={[minPrice - padding, maxPrice + padding]}
            scale="linear"
            padding={{ top: 10, bottom: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{
              paddingTop: '10px',
              fontSize: '12px'
            }}
          />
          <Line
            type="linear"
            dataKey="gateio_price"
            name="Gate.io (spot)"
            stroke="#10B981"
            dot={{ r: 1 }}
            strokeWidth={1.5}
            activeDot={{ r: 4 }}
            connectNulls={true}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="mexc_price"
            name="MEXC (futures)"
            stroke="#9CA3AF"
            dot={{ r: 1 }}
            strokeWidth={1.5}
            activeDot={{ r: 4 }}
            connectNulls={true}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 