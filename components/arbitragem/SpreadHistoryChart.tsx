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
  spread_percentage: number;
}

// Constante para o intervalo de atualização (5 minutos para teste)
const UPDATE_INTERVAL_MS = 300000; // 5 minutos em vez de 30 minutos para teste

export default function SpreadHistoryChart({ symbol }: SpreadHistoryChartProps) {
  const [spreadHistory, setSpreadHistory] = useState<SpreadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpreadHistory = async () => {
    try {
      setLoading(true);
      console.log('Buscando dados do histórico:', new Date().toLocaleString());
      const response = await fetch(`/api/spread-history/24h/${encodeURIComponent(symbol)}`);
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
    console.log('Iniciando componente SpreadHistoryChart');
    fetchSpreadHistory();
    const interval = setInterval(fetchSpreadHistory, UPDATE_INTERVAL_MS);
    return () => {
      console.log('Limpando intervalo');
      clearInterval(interval);
    };
  }, [symbol]);

  const formatDateTime = (timestamp: string) => {
    const [date, time] = timestamp.split(' - ');
    const [day, month] = date.split('/');
    return `${day}/${month} ${time}`;
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        borderColor: 'rgba(75, 85, 99, 0.3)',
        borderWidth: 1,
        titleColor: '#E5E7EB',
        bodyColor: '#10B981',
        padding: 10,
        callbacks: {
          title: (items) => {
            if (items[0]) {
              return formatDateTime(items[0].label);
            }
            return '';
          },
          label: (context: TooltipItem<'line'>) => {
            return `Spread: ${context.parsed.y.toFixed(2)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          display: true
        },
        border: {
          display: false
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          callback: function(value) {
            const label = this.getLabelForValue(value as number);
            return formatDateTime(label);
          },
          maxRotation: -45,
          minRotation: -45,
          autoSkip: true,
          autoSkipPadding: 30,
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          display: true
        },
        border: {
          display: false
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          callback: (value: number | string) => `${value}%`,
        },
        beginAtZero: true,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    layout: {
      padding: {
        bottom: 30 // Aumentado de 15 para 30 para evitar corte das labels
      }
    }
  };

  const chartData = {
    labels: spreadHistory.map(item => item.timestamp),
    datasets: [
      {
        label: 'Spread (%)',
        data: spreadHistory.map(item => item.spread_percentage),
        borderColor: '#10B981', // Verde do tema
        backgroundColor: 'rgba(16, 185, 129, 0.1)', // Verde com transparência
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: '#10B981',
        pointBorderColor: '#FFFFFF',
        pointHoverBackgroundColor: '#10B981',
        pointHoverBorderColor: '#FFFFFF',
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

  const lastSpread = spreadHistory[spreadHistory.length - 1]?.spread_percentage.toFixed(2) || '0.00';
  const lastTimestamp = spreadHistory[spreadHistory.length - 1]?.timestamp || '';

  return (
    <div className="w-full p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Histórico de spread máximo das últimas 24 horas
      </h2>
      <div className="relative h-[400px]">
        <Line options={options} data={chartData} />
      </div>
    </div>
  );
} 