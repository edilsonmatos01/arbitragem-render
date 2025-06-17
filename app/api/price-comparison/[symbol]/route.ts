import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Aviso: Não foi possível conectar ao banco de dados');
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(', ', ' - ');
}

function roundToNearestInterval(date: Date, intervalMinutes: number): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

function adjustToUTC(date: Date): Date {
  return new Date(date.getTime() + (3 * 60 * 60 * 1000));
}

function calculatePrices(spread: number, direction: string): { gateio: number; mexc: number } {
  // Usamos um fator de amplificação para tornar as diferenças mais visíveis
  const basePrice = 1;
  const spreadMultiplier = 1000; // Amplifica a diferença do spread
  
  if (direction === 'SPOT_TO_FUTURES') {
    return {
      gateio: basePrice,
      mexc: basePrice * (1 + (spread * spreadMultiplier))
    };
  } else {
    return {
      gateio: basePrice * (1 + (spread * spreadMultiplier)),
      mexc: basePrice
    };
  }
}

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol;
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (!prisma) {
      console.warn('Aviso: Banco de dados não disponível');
      return NextResponse.json([]);
    }

    // Define o intervalo de 24 horas em UTC
    const now = new Date();
    const utcNow = adjustToUTC(now);
    const utcStart = new Date(utcNow.getTime() - 24 * 60 * 60 * 1000);

    // Busca os dados do banco usando UTC
    const priceHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: utcStart,
          lte: utcNow
        }
      },
      select: {
        timestamp: true,
        exchangeBuy: true,
        exchangeSell: true,
        spread: true,
        direction: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Agrupa os dados em intervalos de 30 minutos
    const groupedData = new Map<string, { gateio: number | null; mexc: number | null; count: number }>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = roundToNearestInterval(new Date(now.getTime() - 24 * 60 * 60 * 1000), 30);
    const endTime = roundToNearestInterval(now, 30);

    while (currentTime <= endTime) {
      const timeKey = formatDateTime(currentTime);
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, { gateio: null, mexc: null, count: 0 });
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Preenche com os dados reais
    for (const record of priceHistory) {
      const localTime = roundToNearestInterval(new Date(record.timestamp), 30);
      const timeKey = formatDateTime(localTime);
      const data = groupedData.get(timeKey) || { gateio: null, mexc: null, count: 0 };

      if (record.spread) {
        const prices = calculatePrices(record.spread, record.direction);
        // Atualizamos os preços apenas se ambos forem válidos
        if (prices.gateio > 0 && prices.mexc > 0) {
          if (data.count === 0) {
            data.gateio = prices.gateio;
            data.mexc = prices.mexc;
          } else {
            // Média ponderada para suavizar as transições
            data.gateio = (data.gateio! * data.count + prices.gateio) / (data.count + 1);
            data.mexc = (data.mexc! * data.count + prices.mexc) / (data.count + 1);
          }
          data.count++;
        }
      }

      groupedData.set(timeKey, data);
    }

    // Processa os dados e preenche gaps
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, prices]) => ({
        timestamp,
        gateio_price: prices.count > 0 ? prices.gateio : null,
        mexc_price: prices.count > 0 ? prices.mexc : null
      }))
      .sort((a, b) => {
        const [dateA, timeA] = a.timestamp.split(' - ');
        const [dateB, timeB] = b.timestamp.split(' - ');
        const [dayA, monthA] = dateA.split('/').map(Number);
        const [dayB, monthB] = dateB.split('/').map(Number);
        const [hourA, minuteA] = timeA.split(':').map(Number);
        const [hourB, minuteB] = timeB.split(':').map(Number);
        
        if (monthA !== monthB) return monthA - monthB;
        if (dayA !== dayB) return dayA - dayB;
        if (hourA !== hourB) return hourA - hourB;
        return minuteA - minuteB;
      });

    // Preenche gaps com interpolação linear mais suave
    let lastValidIndex = -1;
    for (let i = 0; i < formattedData.length; i++) {
      if (formattedData[i].gateio_price !== null && formattedData[i].mexc_price !== null) {
        if (lastValidIndex !== -1 && i - lastValidIndex > 1) {
          const startGateio = formattedData[lastValidIndex].gateio_price!;
          const endGateio = formattedData[i].gateio_price!;
          const startMexc = formattedData[lastValidIndex].mexc_price!;
          const endMexc = formattedData[i].mexc_price!;
          const steps = i - lastValidIndex;

          // Interpolação com curva suave
          for (let j = 1; j < steps; j++) {
            const fraction = j / steps;
            // Função de suavização cúbica
            const smoothFraction = fraction * fraction * (3 - 2 * fraction);
            
            formattedData[lastValidIndex + j].gateio_price = startGateio + (endGateio - startGateio) * smoothFraction;
            formattedData[lastValidIndex + j].mexc_price = startMexc + (endMexc - startMexc) * smoothFraction;
          }
        }
        lastValidIndex = i;
      }
    }

    // Garante que não haja valores nulos isolados
    for (let i = 1; i < formattedData.length - 1; i++) {
      if (formattedData[i].gateio_price === null && formattedData[i-1].gateio_price !== null && formattedData[i+1].gateio_price !== null) {
        formattedData[i].gateio_price = (formattedData[i-1].gateio_price! + formattedData[i+1].gateio_price!) / 2;
      }
      if (formattedData[i].mexc_price === null && formattedData[i-1].mexc_price !== null && formattedData[i+1].mexc_price !== null) {
        formattedData[i].mexc_price = (formattedData[i-1].mexc_price! + formattedData[i+1].mexc_price!) / 2;
      }
    }

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    return NextResponse.json([]);
  }
} 