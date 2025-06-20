"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  timestamp: string;
  spread: number;
}

export default function ArbitrageHistoryChart() {
  // Dados de exemplo
  const data: DataPoint[] = [
    { timestamp: '10:00', spread: 0.45 },
    { timestamp: '10:05', spread: 0.52 },
    { timestamp: '10:10', spread: 0.48 },
    { timestamp: '10:15', spread: 0.55 },
    { timestamp: '10:20', spread: 0.50 },
    { timestamp: '10:25', spread: 0.47 },
    { timestamp: '10:30', spread: 0.53 },
  ];

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4">Histórico de Spreads</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#00C49F' }}
              formatter={(value: number) => [`${value}%`, 'Spread']}
            />
            <Line
              type="monotone"
              dataKey="spread"
              stroke="#00C49F"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 