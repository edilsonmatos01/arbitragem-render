'use client';

import React, { useState, useEffect } from 'react';

interface MaxSpreadCellProps {
  maxSpread: number;
}

export function MaxSpreadCell({ maxSpread }: MaxSpreadCellProps) {
  const [displayValue, setDisplayValue] = useState<number>(maxSpread);

  useEffect(() => {
    setDisplayValue(maxSpread);
  }, [maxSpread]);

  const getSpreadColor = (spread: number) => {
    if (spread > 2) return 'text-green-400';
    if (spread > 1) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <span className={`font-medium ${getSpreadColor(displayValue)}`}>
      {displayValue > 0 ? `${displayValue.toFixed(2)}%` : '--'}
    </span>
  );
}

// Compatibilidade com export default
export default MaxSpreadCell; 