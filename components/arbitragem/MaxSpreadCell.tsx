'use client';

import React from 'react';

interface MaxSpreadCellProps {
  spread: number;
}

export default function MaxSpreadCell({ spread }: MaxSpreadCellProps) {
  const getSpreadColor = (spread: number) => {
    if (spread >= 1) return 'text-green-500';
    if (spread >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`font-semibold ${getSpreadColor(spread)}`}>
      {spread.toFixed(2)}%
    </div>
  );
} 