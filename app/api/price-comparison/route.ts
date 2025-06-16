import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SpreadRecord {
  spread: number;
  direction: string;
  timestamp: Date;
}

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

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
    const groupedData = new Map<string, { spot: number; futures: number; timestamp: string; fullDate: Date }>();
    
    // Encontrar o preço médio para usar como base
    const avgSpread = records.reduce((sum, record) => sum + record.spread, 0) / records.length;
    const basePrice = 50000; // Preço base para simulação
    let lastSpotPrice = basePrice;
    let lastFuturesPrice = basePrice;
    
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

      // Gerar variação aleatória para simular movimentação natural do mercado
      const randomVariation = (Math.random() - 0.5) * avgSpread * 0.5;
      
      // Calcular novos preços com base no spread real e adicionar variação aleatória
      let spotPrice: number;
      let futuresPrice: number;

      if (record.direction === 'spot-to-future') {
        // Spot mais barato que futures
        spotPrice = lastSpotPrice * (1 + randomVariation / 100);
        futuresPrice = spotPrice * (1 + record.spread / 100);
      } else {
        // Futures mais barato que spot
        futuresPrice = lastFuturesPrice * (1 + randomVariation / 100);
        spotPrice = futuresPrice * (1 + record.spread / 100);
      }

      // Atualizar últimos preços
      lastSpotPrice = spotPrice;
      lastFuturesPrice = futuresPrice;

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
        existing.spot = spotPrice;
        existing.futures = futuresPrice;
      }
    });

    // Converter para array e ordenar por timestamp
    const chartData = Array.from(groupedData.values())
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
      .map(item => ({
        timestamp: item.timestamp,
        spot: Number(item.spot.toFixed(2)),
        futures: Number(item.futures.toFixed(2)),
      }));

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