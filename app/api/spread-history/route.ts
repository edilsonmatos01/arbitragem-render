import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

// Função auxiliar para obter a data atual em Brasília
function getCurrentBrasiliaDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');

  console.log('Recebida requisição para símbolo:', symbol);

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  // Calcula 24 horas atrás a partir do horário atual de Brasília
  const currentBrasiliaDate = getCurrentBrasiliaDate();
  const twentyFourHoursAgo = new Date(currentBrasiliaDate.getTime() - 24 * 60 * 60 * 1000);

  console.log('Buscando dados a partir de:', twentyFourHoursAgo.toISOString());

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

    console.log('Registros encontrados:', rawHistory.length);

    if (rawHistory.length === 0) {
      console.log('Nenhum registro encontrado para o símbolo');
      return NextResponse.json([]);
    }

    // Lógica de agregação para intervalos de 30 minutos
    const thirtyMinutesInMs = 30 * 60 * 1000;
    const aggregatedData: { [key: number]: { maxSpread: number; date: Date } } = {};

    for (const record of rawHistory) {
      // Converter o timestamp para horário de Brasília
      const brasiliaDate = convertToBrasiliaTime(record.timestamp);
      // Arredonda para o intervalo de 30 minutos mais próximo
      const bucketTimestamp = Math.floor(brasiliaDate.getTime() / thirtyMinutesInMs) * thirtyMinutesInMs;
      
      if (!aggregatedData[bucketTimestamp]) {
        aggregatedData[bucketTimestamp] = {
          maxSpread: record.spread,
          date: new Date(bucketTimestamp)
        };
      } else if (record.spread > aggregatedData[bucketTimestamp].maxSpread) {
        // Atualiza apenas o spread máximo, mantendo o timestamp do intervalo
        aggregatedData[bucketTimestamp].maxSpread = record.spread;
      }
    }

    const formattedHistory = Object.entries(aggregatedData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, data]) => {
        // Formato brasileiro: DD/MM HH:mm
        const timeLabel = new Date(data.date).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        }).replace(',', '');

        return {
          timestamp: timeLabel,
          spread: data.maxSpread,
        };
      });

    console.log('Dados formatados:', formattedHistory);

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 