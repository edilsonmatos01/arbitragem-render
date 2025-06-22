import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function adjustToUTC(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
}

function formatDateTime(date: Date): string {
  // Primeiro converte para UTC
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  
  // Depois converte para America/Sao_Paulo
  return utcDate.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(', ', ' - ');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const thirtyMinutesInMs = 30 * 60 * 1000;
    const now = new Date();
    const utcNow = adjustToUTC(now);
    const utcStart = new Date(utcNow.getTime() - 24 * 60 * 60 * 1000);

    const rawHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: utcStart,
          lte: utcNow
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    const aggregatedData: Record<number, { maxSpread: number; date: Date }> = {};

    for (const record of rawHistory) {
      const localTime = new Date(record.timestamp);
      const bucketTimestamp = Math.floor(localTime.getTime() / thirtyMinutesInMs) * thirtyMinutesInMs;
      
      if (!aggregatedData[bucketTimestamp] || record.spread > aggregatedData[bucketTimestamp].maxSpread) {
        aggregatedData[bucketTimestamp] = {
          maxSpread: record.spread,
          date: new Date(bucketTimestamp)
        };
      }
    }

    const formattedHistory = Object.entries(aggregatedData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, data]) => ({
        timestamp: formatDateTime(data.date),
        spread: data.maxSpread,
      }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 