import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Função para converter timestamp UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  // Cria uma nova data para não modificar a original
  const utcDate = new Date(date.getTime());
  // Converte para string no fuso horário de Brasília
  const brasiliaString = utcDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  // Converte de volta para Date
  return new Date(brasiliaString);
}

// Função para converter horário de Brasília para UTC
function convertToUTC(date: Date): Date {
  const brasiliaOffset = 180; // UTC-3 em minutos
  return new Date(date.getTime() + brasiliaOffset * 60000);
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

    // Calcula o intervalo de tempo em horário de Brasília
    const now = new Date();
    const brasiliaNow = convertToBrasiliaTime(now);
    const lastValidTime = roundToNearestInterval(brasiliaNow, true);
    const twentyFourHoursAgo = new Date(lastValidTime.getTime() - 24 * 60 * 60 * 1000);

    // Converte para UTC para buscar no banco
    const utcLastValidTime = convertToUTC(lastValidTime);
    const utcTwentyFourHoursAgo = convertToUTC(twentyFourHoursAgo);

    console.log('Buscando dados:', {
      now: now.toISOString(),
      brasiliaNow: brasiliaNow.toLocaleString(),
      lastValidTime: lastValidTime.toLocaleString(),
      utcLastValidTime: utcLastValidTime.toISOString(),
      twentyFourHoursAgo: twentyFourHoursAgo.toLocaleString(),
      utcTwentyFourHoursAgo: utcTwentyFourHoursAgo.toISOString()
    });

    const rawHistory = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: utcTwentyFourHoursAgo,
          lte: utcLastValidTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    console.log(`Encontrados ${rawHistory.length} registros`);

    // Agrupa os dados em intervalos de 30 minutos
    const aggregatedData: Record<string, { maxSpread: number; date: Date }> = {};
    
    for (const record of rawHistory) {
      // Converte o timestamp UTC do banco para horário de Brasília
      const brasiliaDate = convertToBrasiliaTime(record.timestamp);
      const roundedDate = roundToNearestInterval(brasiliaDate, true);
      
      // Ignora registros futuros
      if (roundedDate > lastValidTime) {
        console.log('Ignorando registro futuro:', roundedDate.toLocaleString());
        continue;
      }
      
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

    console.log('Último registro formatado:', formattedHistory[formattedHistory.length - 1]);

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching spread history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 