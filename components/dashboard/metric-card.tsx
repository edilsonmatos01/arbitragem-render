'use client';

import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
}

export default function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <div className="text-2xl font-bold text-custom-cyan">{value}</div>
    </div>
  );
} 