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

function adjustToUTC(date: Date): Date {
  return new Date(date.getTime() + (3 * 60 * 60 * 1000));
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
    const groupedData = new Map<string, { gateio: number | null; mexc: number | null }>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const endTime = now;

    while (currentTime <= endTime) {
      const timeKey = formatDateTime(currentTime);
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, { gateio: null, mexc: null });
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Preenche com os dados reais
    for (const record of priceHistory) {
      const localTime = new Date(record.timestamp);
      const timeKey = formatDateTime(localTime);
      const data = groupedData.get(timeKey) || { gateio: null, mexc: null };

      // Calcula os preços relativos com base no spread
      if (record.exchangeBuy === 'GATEIO_SPOT' && record.spread) {
        const basePrice = 100; // Preço base para visualização
        if (record.direction === 'SPOT_TO_FUTURES') {
          data.gateio = basePrice;
          data.mexc = basePrice * (1 + record.spread / 100);
        } else {
          data.gateio = basePrice;
          data.mexc = basePrice * (1 - record.spread / 100);
        }
      } else if (record.exchangeBuy === 'MEXC_FUTURES' && record.spread) {
        const basePrice = 100; // Preço base para visualização
        if (record.direction === 'FUTURES_TO_SPOT') {
          data.mexc = basePrice;
          data.gateio = basePrice * (1 + record.spread / 100);
        } else {
          data.mexc = basePrice;
          data.gateio = basePrice * (1 - record.spread / 100);
        }
      }

      groupedData.set(timeKey, data);
    }

    // Converte para o formato esperado pelo gráfico
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, prices]) => ({
        timestamp,
        gateio_price: prices.gateio,
        mexc_price: prices.mexc
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

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    return NextResponse.json([]);
  }
} 