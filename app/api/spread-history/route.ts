import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const rawHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      select: {
        timestamp: true,
        spread: true,
      },
    });

    if (rawHistory.length === 0) {
      return NextResponse.json([]);
    }

    // Lógica de agregação para intervalos de 30 minutos
    const thirtyMinutesInMs = 30 * 60 * 1000;
    // A estrutura agora armazena o spread máximo para cada balde de tempo.
    const aggregatedData: { [key: number]: number } = {};

    for (const record of rawHistory) {
      const bucketTimestamp = Math.floor(record.timestamp.getTime() / thirtyMinutesInMs) * thirtyMinutesInMs;
      
      // Se o balde não existir, ou se o spread do registro atual for maior
      // que o máximo já armazenado para esse balde, atualize-o.
      if (!aggregatedData[bucketTimestamp] || record.spread > aggregatedData[bucketTimestamp]) {
        aggregatedData[bucketTimestamp] = record.spread;
      }
    }

    const formattedHistory = Object.entries(aggregatedData).map(([timestamp, maxSpread]) => ({
      timestamp: new Date(parseInt(timestamp)).toISOString(),
      spread: maxSpread, // Agora o valor do spread é o máximo do intervalo
    }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 