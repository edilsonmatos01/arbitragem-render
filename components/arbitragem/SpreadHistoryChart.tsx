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
        
        // Formata os dados para o gráfico
        const formattedData = rawData.map(item => ({
          ...item,
          // Formata o timestamp para uma leitura mais fácil no tooltip/eixo
          timestamp: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        }));

        setData(formattedData);
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
                bottom: 5,
            }}
            >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="timestamp" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} tickFormatter={(value) => `${value.toFixed(2)}%`} />
            <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F9FAFB' }}
                itemStyle={{ color: '#86EFAC' }}
            />
            <Legend wrapperStyle={{ color: '#9CA3AF' }}/>
            <Line type="monotone" dataKey="spread" stroke="#86EFAC" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 8 }} name="Spread (%)" />
            </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 