<<<<<<< HEAD
'use client';

import React from 'react';

=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
interface MetricCardProps {
  title: string;
  value: string;
}

export default function MetricCard({ title, value }: MetricCardProps) {
  return (
<<<<<<< HEAD
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <div className="text-2xl font-bold text-custom-cyan">{value}</div>
=======
    <div className="bg-dark-card p-6 rounded-lg shadow min-h-[100px] flex flex-col justify-center">
      <h3 className="text-xs font-medium text-gray-400 mb-1 tracking-wider uppercase">{title}</h3>
      <p className="text-3xl font-semibold text-white">{value}</p>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    </div>
  );
} 