import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import WebSocket from 'ws';

const prisma = new PrismaClient();

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

interface SpreadRecord {
  spread: number;
  direction: string;
  timestamp: Date;
}

interface MarketPrice {
  bestBid: number;
  bestAsk: number;
}

interface MarketPrices {
  [symbol: string]: {
    spot?: MarketPrice;
    futures?: MarketPrice;
  };
}

let marketPrices: MarketPrices = {};

// Conectar ao websocket local
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.type === 'marketPrices') {
      marketPrices = message.data;
    }
  } catch (error) {
    console.error('Erro ao processar mensagem do websocket:', error);
  }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'O parâmetro symbol é obrigatório' }, { status: 400 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Buscar dados históricos de spread das últimas 24h
    const records = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        spread: true,
        direction: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (records.length < 2) {
      return NextResponse.json({ 
        data: [], 
        message: 'Dados insuficientes para comparação (mínimo 2 registros necessários)' 
      });
    }

    // Agrupar dados por intervalos de 30 minutos
    const groupedData = new Map<string, { 
      spot: number | null;
      futures: number | null;
      timestamp: string; 
      fullDate: Date;
    }>();
    
    records.forEach((record: SpreadRecord) => {
      // Converter para horário de Brasília antes de processar
      const brasiliaDate = convertToBrasiliaTime(new Date(record.timestamp));
      // Arredondar timestamp para intervalos de 30 minutos
      const minutes = brasiliaDate.getMinutes();
      const roundedMinutes = Math.floor(minutes / 30) * 30;
      brasiliaDate.setMinutes(roundedMinutes, 0, 0);
      
      const timeKey = brasiliaDate.toISOString();
      
      // Formato brasileiro: DD/MM HH:mm
      const timeLabel = brasiliaDate.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }) + ' ' + brasiliaDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });

      // Obter preços do websocket
      const prices = marketPrices[symbol];
      if (prices) {
        const spotPrice = prices.spot ? (prices.spot.bestBid + prices.spot.bestAsk) / 2 : null;
        const futuresPrice = prices.futures ? (prices.futures.bestBid + prices.futures.bestAsk) / 2 : null;

        if (!groupedData.has(timeKey)) {
          groupedData.set(timeKey, {
            spot: spotPrice,
            futures: futuresPrice,
            timestamp: timeLabel,
            fullDate: brasiliaDate,
          });
        } else {
          // Se já existe dados para este intervalo, atualizar com os novos preços
          const existing = groupedData.get(timeKey)!;
          if (spotPrice !== null) existing.spot = spotPrice;
          if (futuresPrice !== null) existing.futures = futuresPrice;
        }
      }
    });

    // Converter para array e ordenar por timestamp
    const chartData = Array.from(groupedData.values())
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
      .map(item => ({
        timestamp: item.timestamp,
        spot: item.spot !== null ? Number(item.spot.toFixed(4)) : null,
        futures: item.futures !== null ? Number(item.futures.toFixed(4)) : null,
      }))
      .filter(item => item.spot !== null && item.futures !== null); // Remover pontos sem dados

    return NextResponse.json({
      data: chartData,
      symbol: symbol,
      totalRecords: records.length,
      timeRange: '24h',
    });

  } catch (error) {
    console.error(`Erro ao buscar dados de comparação para ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
} 