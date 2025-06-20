"use client";

import React from 'react';

interface AccumulatedPercentageGaugeProps {
  percentage: number;
}

export default function AccumulatedPercentageGauge({ percentage }: AccumulatedPercentageGaugeProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;
  const rotation = -90; // Rotaciona para começar do topo

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-lg font-medium text-white mb-4">Retorno Acumulado</h3>
      <div className="relative">
        <svg width="200" height="200" className="transform -rotate-90">
          {/* Círculo de fundo */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth="20"
          />
          {/* Círculo de progresso */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#00C49F"
            strokeWidth="20"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-custom-cyan">{percentage}%</span>
        </div>
      </div>
    </div>
  );
} 