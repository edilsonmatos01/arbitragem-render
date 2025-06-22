"use client";

import React from 'react';

interface AccumulatedPercentageGaugeProps {
  percentage: number;
}

export default function AccumulatedPercentageGauge({ percentage }: AccumulatedPercentageGaugeProps) {
  const rotation = (percentage / 100) * 180 - 90;
  const colorCyan = '#00C49F'; // Corresponde a 'custom-cyan'
  // const colorGrayDark = "#374151"; // Cinza escuro para segmentos não preenchidos
  // Usaremos uma cor do nosso tema, talvez um cinza mais escuro que dark-card ou dark-card mesmo.
  const colorSegmentInactive = '#374151'; // Um cinza escuro (gray-700 Tailwind)
  const colorCardBg = '#1F2937'; // Corresponde a 'dark-card'

  // Determinar quantos segmentos preencher (total de 5 segmentos na imagem de referência)
  const filledSegments = Math.round((percentage / 100) * 5);

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-xl font-semibold text-white mb-6">Percentual acumulado</h2>
      <div className="relative w-48 h-24 mb-3">
        {/* Base do medidor (semicírculo cinza escuro) */}
        <div 
          className="absolute w-full h-full rounded-t-full bg-gray-700" 
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }} // Garante que é um semicírculo
        ></div>

        {/* Segmentos do medidor */}
        <div className="absolute w-full h-full flex justify-center items-center" style={{ transform: 'rotate(-90deg)' }}>
          {[...Array(5)].map((_, i) => {
            const segmentRotation = i * (180 / 5);
            const isFilled = i < filledSegments;
            return (
              <div 
                key={i}
                className="absolute w-full h-full"
                style={{
                  transform: `rotate(${segmentRotation}deg)`,
                  clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)', // Define um segmento de "fatia"
                }}
              >
                <div 
                  className="absolute w-1/2 h-full origin-left"
                  style={{
                    backgroundColor: isFilled ? colorCyan : colorSegmentInactive,
                    transform: 'rotate(calc(180deg / 5))', // Ajusta o ângulo do segmento
                    // Adiciona um pequeno espaço entre segmentos se desejar, ex: com transform scale ou pseudo-elementos
                  }}
                ></div>
              </div>
            );
          })}
        </div>
        
        {/* Camada para "esconder" o centro e criar o efeito de arco */}
        <div className="absolute top-1/2 left-1/2 w-[75%] h-[75%] rounded-full transform -translate-x-1/2 -translate-y-[calc(50%-0.5rem)]"
             style={{ backgroundColor: colorCardBg, clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' }}></div>

        {/* Ponteiro */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-[calc(50%-0.5rem)] bg-gray-200 origin-bottom transform -translate-x-1/2"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` , height: 'calc(50% - 8px)'}}
        ></div>
        {/* Ponto central do ponteiro */}
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-gray-200 rounded-full transform -translate-x-1/2 translate-y-[calc(50%-2px)]"></div>

      </div>
      <div className="text-3xl font-bold text-white mt-1">{percentage}%</div>
    </div>
  );
} 