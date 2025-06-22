"use client";

<<<<<<< HEAD
import React from 'react';

=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
interface AccumulatedPercentageGaugeProps {
  percentage: number;
}

export default function AccumulatedPercentageGauge({ percentage }: AccumulatedPercentageGaugeProps) {
<<<<<<< HEAD
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
=======
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
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    </div>
  );
} 