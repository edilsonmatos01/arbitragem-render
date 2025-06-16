import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Função para converter timestamp UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

// Função para arredondar data para o intervalo de 30 minutos mais próximo
function roundToNearestInterval(date: Date, roundDown = true): Date {
  const result = new Date(date);
  const minutes = result.getMinutes();
  const roundedMinutes = roundDown 
    ? Math.floor(minutes / 30) * 30 
    : Math.ceil(minutes / 30) * 30;
  result.setMinutes(roundedMinutes);
  result.setSeconds(0);
  result.setMilliseconds(0);
  return result;
}

// Função para formatar data no padrão brasileiro
function formatBrasiliaTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Calcula o intervalo de tempo
    const now = new Date();
    const brasiliaNow = convertToBrasiliaTime(now);
    // Arredonda para a meia hora anterior
    const lastValidTime = roundToNearestInterval(brasiliaNow, true);
    const twentyFourHoursAgo = new Date(lastValidTime.getTime() - 24 * 60 * 60 * 1000);
    
    const rawHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: twentyFourHoursAgo,
          lte: lastValidTime, // Garante que não pegamos dados futuros
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Agrupa os dados em intervalos de 30 minutos
    const aggregatedData: Record<string, { maxSpread: number; date: Date }> = {};
    
    for (const record of rawHistory) {
      // Converte para horário de Brasília e arredonda para intervalo de 30 minutos
      const brasiliaDate = convertToBrasiliaTime(record.timestamp);
      const roundedDate = roundToNearestInterval(brasiliaDate, true);
      
      // Ignora registros futuros
      if (roundedDate > lastValidTime) continue;
      
      const key = roundedDate.getTime().toString();

      if (!aggregatedData[key] || record.spread > aggregatedData[key].maxSpread) {
        aggregatedData[key] = {
          maxSpread: record.spread,
          date: roundedDate
        };
      }
    }

    // Preenche intervalos faltantes com zero
    let currentTime = new Date(twentyFourHoursAgo);
    
    while (currentTime <= lastValidTime) {
      const key = currentTime.getTime().toString();
      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          maxSpread: 0,
          date: new Date(currentTime)
        };
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // Adiciona 30 minutos
    }

    // Formata os dados para retorno
    const formattedHistory = Object.entries(aggregatedData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, data]) => ({
        timestamp: formatBrasiliaTime(data.date),
        spread: data.maxSpread,
      }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 