'use client';

import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
}

export default function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div className="bg-dark-card p-6 rounded-lg shadow min-h-[100px] flex flex-col justify-center">
      <h3 className="text-xs font-medium text-gray-400 mb-1 tracking-wider uppercase">{title}</h3>
      <p className="text-3xl font-semibold text-white">{value}</p>
    </div>
  );
} 