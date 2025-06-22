'use client';

<<<<<<< HEAD
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
=======
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

interface PriceComparisonChartProps {
  symbol: string;
}

interface PriceData {
  timestamp: string;
<<<<<<< HEAD
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
=======
  spot: number;
  futures: number;
}

interface ApiResponse {
  data: PriceData[];
  symbol: string;
  totalRecords: number;
  timeRange: string;
  message?: string;
}

// Componente de Tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="label text-white font-semibold mb-2">{`${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className={`text-${entry.color === '#86EFAC' ? 'green' : 'blue'}-400`}>
            {`${entry.name}: $${entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      console.log(`Buscando dados para ${symbol}...`);
      const response = await fetch(`/api/price-comparison/${encodeURIComponent(symbol)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao carregar dados: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Dados recebidos para ${symbol}:`, {
        totalPoints: result.length,
        firstPoint: result[0],
        lastPoint: result[result.length - 1],
        hasNullValues: result.some((point: PriceData) => point.gateio_price === null || point.mexc_price === null)
      });

      if (!Array.isArray(result)) {
        throw new Error('Formato de dados inválido');
      }

      if (result.length === 0) {
        throw new Error('Nenhum dado encontrado para o período');
      }

      // Filtra pontos inválidos
      const validData = result.filter((point: PriceData) => 
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
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <p className="text-gray-400">Carregando dados...</p>
=======

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/price-comparison?symbol=${encodeURIComponent(symbol)}`);
        
        if (!response.ok) {
          throw new Error('Falha ao buscar dados de comparação');
        }
        
        const result: ApiResponse = await response.json();
        
        if (result.data.length === 0) {
          setError(result.message || 'Sem dados suficientes para comparação');
          setData([]);
        } else {
          setData(result.data);
        }
      } catch (err) {
        console.error('Erro ao buscar dados de comparação:', err);
        setError('Erro ao carregar dados de comparação');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Carregando dados de comparação...</div>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
      </div>
    );
  }

  if (error) {
    return (
<<<<<<< HEAD
      <div className="flex flex-col items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800 p-4">
        <p className="text-red-400 mb-2">Erro ao carregar dados</p>
        <p className="text-gray-400 text-sm text-center">{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
=======
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ {error}</div>
          <div className="text-gray-500 text-sm">
            Dados de comparação serão exibidos quando houver registros suficientes
          </div>
        </div>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
      </div>
    );
  }

  if (data.length === 0) {
    return (
<<<<<<< HEAD
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <p className="text-gray-400">Nenhum dado disponível</p>
=======
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📊 Sem dados disponíveis</div>
          <div className="text-gray-500 text-sm">
            Aguarde a coleta de dados de preços para visualizar a comparação
          </div>
        </div>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
      </div>
    );
  }

<<<<<<< HEAD
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
=======
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 60, // Aumentado para acomodar labels de data/hora
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="timestamp" 
            stroke="#9CA3AF" 
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={Math.max(0, Math.floor(data.length / 8))} // Mostra no máximo 8 labels
          />
          <YAxis 
            stroke="#9CA3AF" 
            tickFormatter={(value) => `$${value.toLocaleString('pt-BR')}`}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#9CA3AF' }} />
          <Line 
            type="monotone" 
            dataKey="spot" 
            stroke="#86EFAC" 
            strokeWidth={2} 
            dot={{ r: 3 }} 
            activeDot={{ r: 6 }} 
            name="Preço Spot" 
          />
          <Line 
            type="monotone" 
            dataKey="futures" 
            stroke="#60A5FA" 
            strokeWidth={2} 
            dot={{ r: 3 }} 
            activeDot={{ r: 6 }} 
            name="Preço Futures" 
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 