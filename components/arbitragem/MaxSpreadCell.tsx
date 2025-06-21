'use client';

import React from 'react';

interface MaxSpreadCellProps {
  maxSpread: number;
}

export function MaxSpreadCell({ maxSpread }: MaxSpreadCellProps) {
  return (
    <span className={maxSpread >= 0.5 ? 'text-yellow-400' : ''}>
      {maxSpread.toFixed(3)}%
    </span>
  );
} 