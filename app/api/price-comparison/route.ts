import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'O parâmetro symbol é obrigatório' }, { status: 400 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Buscar dados históricos de spread das últimas 24h
    // Como não temos campos específicos de spotPrice/futuresPrice no schema atual,
    // vamos simular os dados baseados no spread e direção
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
    
    records.forEach(record => {
      // Arredondar timestamp para intervalos de 30 minutos
      const date = new Date(record.timestamp);
      const minutes = date.getMinutes();
      const roundedMinutes = Math.floor(minutes / 30) * 30;
      date.setMinutes(roundedMinutes, 0, 0);
      
      const timeKey = date.toISOString();
      
      // Formato brasileiro: DD/MM HH:mm
      const timeLabel = date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      }) + ' ' + date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Simular preços baseados no spread
      // Assumindo um preço base hipotético e calculando spot/futures baseado no spread
      const basePrice = 50000; // Preço base para simulação
      let spotPrice: number;
      let futuresPrice: number;

      if (record.direction === 'spot-to-future') {
        // Spot mais barato que futures
        spotPrice = basePrice;
        futuresPrice = basePrice * (1 + record.spread / 100);
      } else {
        // Futures mais barato que spot
        futuresPrice = basePrice;
        spotPrice = basePrice * (1 + record.spread / 100);
      }

      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, {
          spot: spotPrice,
          futures: futuresPrice,
          timestamp: timeLabel,
          fullDate: date,
        });
      } else {
        // Se já existe dados para este intervalo, fazer média
        const existing = groupedData.get(timeKey)!;
        existing.spot = (existing.spot + spotPrice) / 2;
        existing.futures = (existing.futures + futuresPrice) / 2;
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