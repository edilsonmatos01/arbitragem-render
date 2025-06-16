"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Dados mockados para o gráfico de área
const areaChartData = [
  { name: 'Jan', value: 0.40 },
  { name: 'Fev', value: 0.35 },
  { name: 'Mar', value: 0.60 },
  { name: 'Abr', value: 0.45 },
  { name: 'Mai', value: 0.70 },
  { name: 'Jun', value: 0.55 },
  { name: 'Jul', value: 0.65 },
];

const filterButtons = [
    { label: '7D', dataKey: '7D' }, 
    { label: '15D', dataKey: '15D' }, 
    { label: '30D', dataKey: '30D' }, 
    { label: '6M', dataKey: '6M' }, 
    { label: '1A', dataKey: '1A' }
];

export default function ArbitrageHistoryChart() {
  // TODO: Implementar lógica de estado para o botão ativo e filtragem de dados
  const activeButton = '30D'; // Placeholder para botão ativo

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Histórico de Arbitragem</h2>
        <div className="flex space-x-1">
          {filterButtons.map((period) => (
            <button 
              key={period.label} 
              className={`px-3 py-1 text-xs rounded-md focus:outline-none transition-colors
                          ${activeButton === period.label 
                            ? 'bg-custom-cyan text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={areaChartData} margin={{ top: 5, right: 20, left: -30, bottom: 5 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
            <YAxis 
              stroke="#6B7280" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.375rem' }} 
              itemStyle={{ color: '#E5E7EB' }}
              labelStyle={{ color: '#D1D5DB', fontWeight: 'bold' }}
              formatter={(value: number) => [`${value}%`, 'Retorno']}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#00C49F" 
              fillOpacity={1} 
              fill="url(#colorValue)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 