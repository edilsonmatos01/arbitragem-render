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

// Constante para o intervalo de atualização (30 minutos)
const UPDATE_INTERVAL_MS = 1800000;

export default function SpreadHistoryChart({ symbol }: SpreadHistoryChartProps) {
  const [spreadHistory, setSpreadHistory] = useState<SpreadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpreadHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/spread-history?symbol=${encodeURIComponent(symbol)}`);
      if (!response.ok) throw new Error('Failed to fetch spread history');
      const data = await response.json();
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
    const interval = setInterval(fetchSpreadHistory, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [symbol]);

  const formatTime = (timestamp: string) => {
    // Assumindo que o timestamp já está em formato DD/MM HH:mm
    // Vamos extrair apenas o horário (HH:mm)
    return timestamp.split(' ')[1];
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items[0]) {
              // Mostra a data completa no tooltip
              return items[0].label;
            }
            return '';
          },
          label: (context: TooltipItem<'line'>) => {
            return `Spread (%): ${context.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: function(value) {
            // Mostra apenas o horário no eixo X
            const label = this.getLabelForValue(value as number);
            return formatTime(label);
          },
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 30,
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value}%`,
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
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

  const lastSpread = spreadHistory[spreadHistory.length - 1]?.spread.toFixed(2) || '0.00';
  const lastTimestamp = spreadHistory[spreadHistory.length - 1]?.timestamp || '';

  return (
    <div className="w-full p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Histórico de spread máximo das últimas 24 horas
      </h2>
      <div className="relative">
        <Line options={options} data={chartData} />
      </div>
    </div>
  );
} 