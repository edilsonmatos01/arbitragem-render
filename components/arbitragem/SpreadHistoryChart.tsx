'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SpreadHistoryChartProps {
  symbol: string;
}

interface SpreadData {
  timestamp: string;
  spread: number;
}

export default function SpreadHistoryChart({ symbol }: SpreadHistoryChartProps) {
  const [spreadHistory, setSpreadHistory] = useState<SpreadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpreadHistory = async () => {
    try {
      console.log('Buscando dados para o símbolo:', symbol);
      setLoading(true);
      const response = await fetch(`/api/spread-history?symbol=${encodeURIComponent(symbol)}`);
      if (!response.ok) throw new Error('Failed to fetch spread history');
      const data = await response.json();
      console.log('Dados recebidos:', data);
      setSpreadHistory(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching spread history:', error);
      setError('Falha ao carregar dados do histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpreadHistory();
    // Atualiza a cada 30 segundos
    const interval = setInterval(fetchSpreadHistory, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  const getCurrentBrasiliaTime = () => {
    return new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '');
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            return `Spread (%): ${context.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value}%`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  const chartData = {
    labels: spreadHistory.map(item => item.timestamp),
    datasets: [
      {
        label: 'Spread (%)',
        data: spreadHistory.map(item => item.spread),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        pointRadius: 3,
      },
    ],
  };

  const currentTime = getCurrentBrasiliaTime();
  const lastSpread = spreadHistory[spreadHistory.length - 1]?.spread.toFixed(2) || '0.00';

  if (loading) {
    return (
      <div className="w-full p-4 bg-gray-800 rounded-lg">
        <div className="text-center text-gray-400">Carregando dados do histórico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 bg-gray-800 rounded-lg">
        <div className="text-center text-red-500">{error}</div>
      </div>
    );
  }

  if (spreadHistory.length === 0) {
    return (
      <div className="w-full p-4 bg-gray-800 rounded-lg">
        <div className="text-center text-gray-500">
          Nenhum dado de histórico encontrado para as últimas 24 horas
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Histórico de spread máximo das últimas 24 horas
      </h2>
      <div className="relative">
        <Line options={options} data={chartData} />
        <div className="absolute top-0 right-0 bg-gray-800 p-2 rounded text-white">
          {currentTime}
          <br />
          Spread (%): {lastSpread}
        </div>
      </div>
    </div>
  );
} 