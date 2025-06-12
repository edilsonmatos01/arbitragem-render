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
    const aggregatedData: { [key: number]: { totalSpread: number; count: number } } = {};

    for (const record of rawHistory) {
      const bucketTimestamp = Math.floor(record.timestamp.getTime() / thirtyMinutesInMs) * thirtyMinutesInMs;
      
      if (!aggregatedData[bucketTimestamp]) {
        aggregatedData[bucketTimestamp] = { totalSpread: 0, count: 0 };
      }
      
      aggregatedData[bucketTimestamp].totalSpread += record.spread;
      aggregatedData[bucketTimestamp].count += 1;
    }

    const formattedHistory = Object.entries(aggregatedData).map(([timestamp, data]) => ({
      timestamp: new Date(parseInt(timestamp)).toISOString(),
      spread: data.totalSpread / data.count,
    }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 