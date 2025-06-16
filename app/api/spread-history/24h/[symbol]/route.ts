import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Aviso: Não foi possível conectar ao banco de dados');
}

export const dynamic = 'force-dynamic';

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  }) + ' - ' + date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Busca os dados do banco
    const spreadHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: twentyFourHoursAgo
        }
      },
      select: {
        timestamp: true,
        spread: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Agrupa os dados em intervalos de 30 minutos
    const groupedData = new Map<string, number>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = new Date(twentyFourHoursAgo);
    currentTime.setMinutes(Math.floor(currentTime.getMinutes() / 30) * 30, 0, 0);
    const now = new Date();

    while (currentTime <= now) {
      const timeKey = formatDateTime(currentTime);
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, 0);
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Preenche com os dados reais
    for (const record of spreadHistory) {
      const recordTime = new Date(record.timestamp);
      recordTime.setMinutes(Math.floor(recordTime.getMinutes() / 30) * 30, 0, 0);
      const timeKey = formatDateTime(recordTime);
      const currentMax = groupedData.get(timeKey) || 0;
      groupedData.set(timeKey, Math.max(currentMax, record.spread));
    }

    // Converte para o formato esperado pelo gráfico
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, spread]) => ({
        timestamp,
        spread_percentage: spread
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
    console.error('Error fetching spread history:', error);
    return NextResponse.json([]);
  }
} 