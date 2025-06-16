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
        setData(rawData);
      } catch (err: any) {
        setError(err.message || 'Ocorreu um erro.');
      } finally {
        setIsLoading(false);
      }
    };

    // Busca inicial
    if (symbol) {
      fetchData();
    }

    // Configura atualização periódica a cada 30 segundos
    const interval = setInterval(fetchData, 30000);

    // Limpa o intervalo quando o componente é desmontado
    return () => clearInterval(interval);
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
      </ResponsiveContainer>
    </div>
  );
} 