'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SpreadHistoryChartProps {
  symbol: string;
}

interface SpreadData {
  timestamp: string;
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
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-gray-400">Carregando dados...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-gray-400">Nenhum dado disponível</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            tickFormatter={(value) => value.split(' - ')[1]}
            interval="preserveStartEnd"
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            tickFormatter={(value) => `${value.toFixed(2)}%`}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="linear"
            dataKey="spread"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10B981' }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 