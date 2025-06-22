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
    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="text-white font-semibold mb-2">{`Data: ${formatDateTime(label || '')}`}</p>
        <p className="text-green-400">
          {`Gate.io (spot): $${payload[0]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
        </p>
        <p className="text-blue-400">
          {`MEXC (futures): $${payload[1]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
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
      console.log(`Buscando dados para ${symbol}...`);
      const response = await fetch(`/api/price-comparison?symbol=${encodeURIComponent(symbol)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao carregar dados: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Dados recebidos para ${symbol}:`, {
        totalPoints: result.data.length,
        firstPoint: result.data[0],
        lastPoint: result.data[result.data.length - 1]
      });

      if (!Array.isArray(result.data)) {
        throw new Error('Formato de dados inválido');
      }

      if (result.data.length === 0) {
        throw new Error(result.message || 'Nenhum dado encontrado para o período');
      }

      // Filtra pontos inválidos
      const validData = result.data.filter((point: PriceData) => 
        point.gateio_price !== null && 
        point.mexc_price !== null && 
        !isNaN(point.gateio_price) && 
        !isNaN(point.mexc_price) &&
        point.gateio_price > 0 &&
        point.mexc_price > 0
      );

      if (validData.length === 0) {
        throw new Error('Nenhum dado válido encontrado para o período');
      }

      setData(validData);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erro ao buscar dados de preços:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados de preços');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-gray-400">Carregando dados de comparação...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="text-red-400 mb-2">⚠️ {error}</div>
        <div className="text-gray-500 text-sm text-center">
          Dados de comparação serão exibidos quando houver registros suficientes
        </div>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📊 Sem dados disponíveis</div>
          <div className="text-gray-500 text-sm">
            Aguarde a coleta de dados de preços para visualizar a comparação
          </div>
        </div>
      </div>
    );
  }

  // Encontra os valores mínimo e máximo para ajustar a escala do eixo Y
  const allPrices = data.flatMap(d => [d.gateio_price, d.mexc_price].filter(p => p !== null) as number[]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1; // 10% de padding

  return (
    <div className="w-full h-[400px] bg-gray-900 rounded-lg border border-gray-800 p-4">
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
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={Math.max(0, Math.floor(data.length / 8))} // Mostra no máximo 8 labels
            tickFormatter={formatDateTime}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value) => `$${value.toLocaleString('pt-BR', { minimumFractionDigits: 8 })}`}
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
            type="monotone"
            dataKey="gateio_price"
            name="Gate.io (spot)"
            stroke="#86EFAC"
            dot={{ r: 2 }}
            strokeWidth={2}
            activeDot={{ r: 6 }}
            connectNulls={true}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="mexc_price"
            name="MEXC (futures)"
            stroke="#60A5FA"
            dot={{ r: 2 }}
            strokeWidth={2}
            activeDot={{ r: 6 }}
            connectNulls={true}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 