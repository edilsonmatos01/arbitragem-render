import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000); // UTC-3
}

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
    const aggregatedData: { [key: number]: { maxSpread: number; date: Date } } = {};

    for (const record of rawHistory) {
      // Converter o timestamp para horário de Brasília antes de processar
      const brasiliaTimestamp = convertToBrasiliaTime(record.timestamp);
      const bucketTimestamp = Math.floor(brasiliaTimestamp.getTime() / thirtyMinutesInMs) * thirtyMinutesInMs;
      
      // Se o balde não existir, ou se o spread do registro atual for maior
      // que o máximo já armazenado para esse balde, atualize-o.
      if (!aggregatedData[bucketTimestamp] || record.spread > aggregatedData[bucketTimestamp].maxSpread) {
        aggregatedData[bucketTimestamp] = {
          maxSpread: record.spread,
          date: new Date(bucketTimestamp)
        };
      }
    }

    const formattedHistory = Object.entries(aggregatedData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([timestamp, data]) => {
        // Formato brasileiro: DD/MM HH:mm
        const timeLabel = data.date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit',
          timeZone: 'America/Sao_Paulo'
        }) + ' ' + data.date.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });

        return {
          timestamp: timeLabel,
          spread: data.maxSpread,
        };
      });

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 