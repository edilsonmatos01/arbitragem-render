import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // Define o intervalo de 24 horas
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Buscando dados para ${symbol} de ${start.toISOString()} até ${now.toISOString()}`);

    // Busca os dados do banco
    const priceHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: start,
          lte: now
        }
      },
      select: {
        timestamp: true,
        spotPrice: true,
        futuresPrice: true,
        id: true,
        symbol: true,
        exchangeBuy: true,
        exchangeSell: true,
        direction: true,
        spread: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    console.log(`Encontrados ${priceHistory.length} registros para ${symbol}`);

    // Agrupa os dados em intervalos de 30 minutos
    const groupedData = new Map<string, { 
      spot: { sum: number; count: number }; 
      futures: { sum: number; count: number }; 
    }>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = roundToNearestInterval(start, 30);
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

      if (record.spotPrice !== null) {
        data.spot.sum += record.spotPrice;
        data.spot.count++;
      }

      if (record.futuresPrice !== null) {
        data.futures.sum += record.futuresPrice;
        data.futures.count++;
      }

      groupedData.set(timeKey, data);
    }

    // Formata os dados finais
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        gateio_price: data.spot.count > 0 ? Number(data.spot.sum / data.spot.count) : null,
        mexc_price: data.futures.count > 0 ? Number(data.futures.sum / data.futures.count) : null
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

    console.log(`Dados formatados: ${formattedData.length} pontos`);
    console.log(`Primeiro ponto: ${JSON.stringify(formattedData[0])}`);
    console.log(`Último ponto: ${JSON.stringify(formattedData[formattedData.length - 1])}`);

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar dados';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 