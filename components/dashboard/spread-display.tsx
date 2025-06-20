'use client';

import React from 'react';

export default function SpreadDisplay() {
  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Spread em Tempo Real</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-dark-bg p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-2">BTC/USDT</h3>
          <div className="flex justify-between">
            <span className="text-gray-400">Spread:</span>
            <span className="text-custom-cyan">0.45%</span>
          </div>
        </div>
        <div className="bg-dark-bg p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-2">ETH/USDT</h3>
          <div className="flex justify-between">
            <span className="text-gray-400">Spread:</span>
            <span className="text-custom-cyan">0.32%</span>
          </div>
        </div>
        <div className="bg-dark-bg p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-2">BNB/USDT</h3>
          <div className="flex justify-between">
            <span className="text-gray-400">Spread:</span>
            <span className="text-custom-cyan">0.28%</span>
          </div>
        </div>
      </div>
    </div>
  );
} 