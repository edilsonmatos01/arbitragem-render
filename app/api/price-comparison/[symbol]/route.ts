import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adjustToUTC } from '@/lib/utils';

function roundToNearestInterval(date: Date, intervalMinutes: number): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
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
        spotPrice: true,
        futuresPrice: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Agrupa os dados em intervalos de 30 minutos
    const groupedData = new Map<string, { 
      spot: { sum: number; count: number }; 
      futures: { sum: number; count: number }; 
    }>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = roundToNearestInterval(new Date(now.getTime() - 24 * 60 * 60 * 1000), 30);
    const endTime = roundToNearestInterval(now, 30);

    while (currentTime <= endTime) {
      const timeKey = formatDateTime(currentTime);
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, {
          spot: { sum: 0, count: 0 },
          futures: { sum: 0, count: 0 }
        });
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Processa os dados reais
    for (const record of priceHistory) {
      const localTime = roundToNearestInterval(new Date(record.timestamp), 30);
      const timeKey = formatDateTime(localTime);
      const data = groupedData.get(timeKey) || {
        spot: { sum: 0, count: 0 },
        futures: { sum: 0, count: 0 }
      };

      if (record.spotPrice) {
        data.spot.sum += parseFloat(record.spotPrice);
        data.spot.count++;
      }

      if (record.futuresPrice) {
        data.futures.sum += parseFloat(record.futuresPrice);
        data.futures.count++;
      }

      groupedData.set(timeKey, data);
    }

    // Formata os dados finais
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        gateio_price: data.spot.count > 0 ? data.spot.sum / data.spot.count : null,
        mexc_price: data.futures.count > 0 ? data.futures.sum / data.futures.count : null
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

    // Interpolação para pontos faltantes
    let lastValidIndex = -1;
    for (let i = 0; i < formattedData.length; i++) {
      if (formattedData[i].gateio_price !== null && formattedData[i].mexc_price !== null) {
        if (lastValidIndex !== -1 && i - lastValidIndex > 1) {
          const startGateio = formattedData[lastValidIndex].gateio_price!;
          const endGateio = formattedData[i].gateio_price!;
          const startMexc = formattedData[lastValidIndex].mexc_price!;
          const endMexc = formattedData[i].mexc_price!;
          const steps = i - lastValidIndex;

          for (let j = 1; j < steps; j++) {
            const fraction = j / steps;
            const smoothFraction = fraction * fraction * (3 - 2 * fraction);
            
            formattedData[lastValidIndex + j].gateio_price = startGateio + (endGateio - startGateio) * smoothFraction;
            formattedData[lastValidIndex + j].mexc_price = startMexc + (endMexc - startMexc) * smoothFraction;
          }
        }
        lastValidIndex = i;
      }
    }

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    return NextResponse.json([]);
  }
} 