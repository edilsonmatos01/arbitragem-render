'use client';

<<<<<<< HEAD
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
=======
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

interface SpreadHistoryChartProps {
  symbol: string;
}

interface SpreadData {
  timestamp: string;
<<<<<<< HEAD
  spread_percentage: number;
}

type CustomTooltipProps = TooltipProps<ValueType, NameType>;

function formatDateTime(timestamp: string) {
  const [date, time] = timestamp.split(' - ');
  const [day, month] = date.split('/');
  return `${day}/${month} ${time}`;
}

export default function SpreadHistoryChart({ symbol }: SpreadHistoryChartProps) {
  const [spreadHistory, setSpreadHistory] = useState<SpreadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchSpreadHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/spread-history/24h/${encodeURIComponent(symbol)}`);
        if (!response.ok) throw new Error('Failed to fetch spread history');
        const data = await response.json();
        setSpreadHistory(data);
        setLastUpdate(new Date());
        setError(null);
      } catch (error) {
        console.error('Error fetching spread history:', error);
        setError('Falha ao carregar dados do histórico');
      } finally {
        setLoading(false);
      }
    };

    fetchSpreadHistory();
    const interval = setInterval(fetchSpreadHistory, 300000); // 5 minutos
    return () => clearInterval(interval);
  }, [symbol]);

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0) {
      const value = payload[0].value as number;
      return (
        <div className="bg-gray-800 border border-gray-700 p-2 rounded-md shadow-lg">
          <p className="text-white">{`Data: ${formatDateTime(label?.toString() || '')}`}</p>
          <p className="text-green-400">{`Spread: ${value.toFixed(2)}%`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <p className="text-gray-400">Carregando dados do histórico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (spreadHistory.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <p className="text-gray-400">Nenhum dado de histórico encontrado para as últimas 24 horas</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          Histórico de spread máximo das últimas 24 horas
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
        <LineChart data={spreadHistory} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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
            tickFormatter={(value) => `${value}%`}
            domain={['auto', 'auto']}
            padding={{ top: 10, bottom: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="basis"
            dataKey="spread_percentage"
            stroke="#10B981"
            dot={{ r: 1 }}
            strokeWidth={1.5}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={true}
          />
        </LineChart>
=======
  spread: number;
}

// Componente de Tooltip customizado para formatar os valores
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="label text-white font-semibold mb-2">{`${label}`}</p>
        <p className="intro text-green-400">{`Spread (%): ${payload[0].value.toFixed(2)}`}</p>
      </div>
    );
  }
  return null;
};

export default function SpreadHistoryChart({ symbol }: SpreadHistoryChartProps) {
  const [data, setData] = useState<SpreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/spread-history?symbol=${encodeURIComponent(symbol)}`);
        if (!response.ok) {
          throw new Error('Falha ao buscar o histórico de spread.');
        }
        const rawData: SpreadData[] = await response.json();
        
        // A API já retorna o timestamp formatado, não precisamos reformatar
        setData(rawData);
      } catch (err: any) {
        setError(err.message || 'Ocorreu um erro.');
      } finally {
        setIsLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol]);

  if (isLoading) {
    return <div className="text-center p-8 text-gray-400">Carregando histórico...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Erro: {error}</div>;
  }

  if (data.length === 0) {
    return <div className="text-center p-8 text-gray-500">Nenhum dado de histórico de spread encontrado para as últimas 24 horas.</div>;
  }

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
            <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} tickFormatter={(value) => `${value.toFixed(2)}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#9CA3AF' }}/>
            <Line type="monotone" dataKey="spread" stroke="#86EFAC" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 8 }} name="Spread (%)" />
            </LineChart>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
      </ResponsiveContainer>
    </div>
  );
} 