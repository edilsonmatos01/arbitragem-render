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

// Constante para o intervalo de atualização (5 minutos)
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

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

// Componente de Tooltip customizado
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length > 0) {
    const gateio = payload.find(p => p.dataKey === 'gateio_price');
    const mexc = payload.find(p => p.dataKey === 'mexc_price');

    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="text-white font-semibold mb-2">{`Data: ${formatDateTime(label || '')}`}</p>
        <p className="text-green-400">
          {`Gate.io (spot): $${gateio?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
        </p>
        <p className="text-blue-400">
          {`MEXC (futures): $${mexc?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
        </p>
      </div>
    );
  }
  return null;
};

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/price-comparison?symbol=${encodeURIComponent(symbol)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro: ${response.status}`);
      }

      const result = await response.json();
      if (!Array.isArray(result.data)) throw new Error('Formato de dados inválido');

      const validData = result.data.filter((d: PriceData) => d.gateio_price && d.mexc_price && d.gateio_price > 0 && d.mexc_price > 0);

      if (validData.length === 0) throw new Error('Sem dados válidos para exibir');

      setData(validData);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || error || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center text-gray-400">
          {loading ? 'Carregando...' : error || 'Sem dados disponíveis.'}
        </div>
      </div>
    );
  }

  const allPrices = data.flatMap(d => [d.gateio_price, d.mexc_price] as number[]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="w-full h-[400px] bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Comparativo de Preços - {symbol}</h3>
        {lastUpdate && (
          <span className="text-sm text-gray-400">
            Atualizado: {lastUpdate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={Math.max(0, Math.floor(data.length / 8))}
            tickFormatter={formatDateTime}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value) => `$${value.toFixed(6)}`}
            domain={[minPrice - padding, maxPrice + padding]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
          <Line type="monotone" dataKey="gateio_price" name="Gate.io (spot)" stroke="#86EFAC" dot={{ r: 2 }} strokeWidth={2} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="mexc_price" name="MEXC (futures)" stroke="#60A5FA" dot={{ r: 2 }} strokeWidth={2} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 