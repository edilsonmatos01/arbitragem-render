import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roundToNearestInterval(date: Date, intervalMinutes: number): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(', ', ' - ');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (!prisma) {
      console.warn('Aviso: Banco de dados não disponível');
      return NextResponse.json([]);
    }

    // Define o intervalo de 24 horas
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Buscando dados para ${symbol} de ${start.toISOString()} até ${now.toISOString()}`);

    // Primeiro, vamos verificar se a tabela PriceHistory existe e tem dados
    try {
      const totalRecords = await prisma.priceHistory.count();
      console.log(`Total de registros na PriceHistory: ${totalRecords}`);
      
      const recentRecords = await prisma.priceHistory.count({
        where: {
          timestamp: { gte: start }
        }
      });
      console.log(`Registros recentes (24h): ${recentRecords}`);
      
      const symbolRecords = await prisma.priceHistory.count({
        where: {
          symbol: symbol,
          timestamp: { gte: start }
        }
      });
      console.log(`Registros para ${symbol} nas últimas 24h: ${symbolRecords}`);
    } catch (debugError) {
      console.error('Erro ao verificar dados da PriceHistory:', debugError);
      // Se a tabela PriceHistory não existir ou houver erro, vamos tentar a SpreadHistory
      console.log('Tentando usar SpreadHistory como fallback...');
      
      const spreadHistory = await prisma.spreadHistory.findMany({
        where: {
          symbol: symbol,
          timestamp: {
            gte: start,
            lte: now
          },
                     spotPrice: { gt: 0 },
           futuresPrice: { gt: 0 }
        },
        select: {
          timestamp: true,
          spotPrice: true,
          futuresPrice: true
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

      console.log(`Encontrados ${spreadHistory.length} registros na SpreadHistory para ${symbol}`);

      if (spreadHistory.length === 0) {
        return NextResponse.json([]);
      }

      // Agrupa os dados em intervalos de 30 minutos usando SpreadHistory
      const groupedData = new Map<string, { 
        spot: { sum: number; count: number }; 
        futures: { sum: number; count: number }; 
      }>();
      
      // Inicializa todos os intervalos de 30 minutos
      let currentTime = roundToNearestInterval(start, 30);
      const endTime = roundToNearestInterval(now, 30);

      while (currentTime <= endTime) {
        const timeKey = formatDateTime(currentTime);
        if (!groupedData.has(timeKey)) {
          groupedData.set(timeKey, {
            spot: { sum: 0, count: 0 },
            futures: { sum: 0, count: 0 }
          });
        }
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      }

      // Processa os dados reais da SpreadHistory
      for (const record of spreadHistory) {
        const localTime = roundToNearestInterval(new Date(record.timestamp), 30);
        const timeKey = formatDateTime(localTime);
        const data = groupedData.get(timeKey) || {
          spot: { sum: 0, count: 0 },
          futures: { sum: 0, count: 0 }
        };

        if (record.spotPrice !== null && record.spotPrice > 0) {
          data.spot.sum += record.spotPrice;
          data.spot.count++;
        }

        if (record.futuresPrice !== null && record.futuresPrice > 0) {
          data.futures.sum += record.futuresPrice;
          data.futures.count++;
        }

        groupedData.set(timeKey, data);
      }

      // Formata os dados finais
      const formattedData = Array.from(groupedData.entries())
        .map(([timestamp, data]) => ({
          timestamp,
          gateio_price: data.spot.count > 0 ? Number(data.spot.sum / data.spot.count) : null,
          mexc_price: data.futures.count > 0 ? Number(data.futures.sum / data.futures.count) : null
        }))
        .filter(data => data.gateio_price !== null && data.mexc_price !== null)
        .sort((a, b) => {
          const [dateA, timeA] = a.timestamp.split(' - ');
          const [dateB, timeB] = b.timestamp.split(' - ');
          const [dayA, monthA] = dateA.split('/').map(Number);
          const [dayB, monthB] = dateB.split('/').map(Number);
          const [hourA, minuteA] = timeA.split(':').map(Number);
          const [hourB, minuteB] = timeB.split(':').map(Number);
          
          if (monthA !== monthB) return monthA - monthB;
          if (dayA !== dayB) return dayA - dayB;
          if (hourA !== hourB) return hourA - hourB;
          return minuteA - minuteB;
        });

      console.log(`Dados formatados (SpreadHistory): ${formattedData.length} pontos`);
      return NextResponse.json(formattedData);
    }

    // Busca os dados do banco da tabela PriceHistory
    const priceHistory = await prisma.priceHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: start,
          lte: now
        }
      },
      select: {
        timestamp: true,
        gateioSpotAsk: true,
        gateioSpotBid: true,
        mexcFuturesAsk: true,
        mexcFuturesBid: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    console.log(`Encontrados ${priceHistory.length} registros para ${symbol}`);

    if (priceHistory.length === 0) {
      return NextResponse.json([]);
    }

    // Agrupa os dados em intervalos de 30 minutos
    const groupedData = new Map<string, { 
      spot: { sum: number; count: number }; 
      futures: { sum: number; count: number }; 
    }>();
    
    // Inicializa todos os intervalos de 30 minutos
    let currentTime = roundToNearestInterval(start, 30);
    const endTime = roundToNearestInterval(now, 30);

    while (currentTime <= endTime) {
      const timeKey = formatDateTime(currentTime);
      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, {
          spot: { sum: 0, count: 0 },
          futures: { sum: 0, count: 0 }
        });
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Processa os dados reais
    for (const record of priceHistory) {
      const localTime = roundToNearestInterval(new Date(record.timestamp), 30);
      const timeKey = formatDateTime(localTime);
      const data = groupedData.get(timeKey) || {
        spot: { sum: 0, count: 0 },
        futures: { sum: 0, count: 0 }
      };

      // Calcula preço médio Gate.io Spot (bid + ask) / 2
      if (record.gateioSpotAsk !== null && record.gateioSpotBid !== null) {
        const gateioSpotPrice = (record.gateioSpotAsk + record.gateioSpotBid) / 2;
        data.spot.sum += gateioSpotPrice;
        data.spot.count++;
      }

      // Calcula preço médio MEXC Futures (bid + ask) / 2
      if (record.mexcFuturesAsk !== null && record.mexcFuturesBid !== null) {
        const mexcFuturesPrice = (record.mexcFuturesAsk + record.mexcFuturesBid) / 2;
        data.futures.sum += mexcFuturesPrice;
        data.futures.count++;
      }

      groupedData.set(timeKey, data);
    }

    // Formata os dados finais
    const formattedData = Array.from(groupedData.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        gateio_price: data.spot.count > 0 ? Number(data.spot.sum / data.spot.count) : null,
        mexc_price: data.futures.count > 0 ? Number(data.futures.sum / data.futures.count) : null
      }))
      .filter(data => data.gateio_price !== null && data.mexc_price !== null) // Remove pontos sem dados
      .sort((a, b) => {
        const [dateA, timeA] = a.timestamp.split(' - ');
        const [dateB, timeB] = b.timestamp.split(' - ');
        const [dayA, monthA] = dateA.split('/').map(Number);
        const [dayB, monthB] = dateB.split('/').map(Number);
        const [hourA, minuteA] = timeA.split(':').map(Number);
        const [hourB, minuteB] = timeB.split(':').map(Number);
        
        if (monthA !== monthB) return monthA - monthB;
        if (dayA !== dayB) return dayA - dayB;
        if (hourA !== hourB) return hourA - hourB;
        return minuteA - minuteB;
      });

    console.log(`Dados formatados: ${formattedData.length} pontos`);
    if (formattedData.length > 0) {
      console.log(`Primeiro ponto: ${JSON.stringify(formattedData[0])}`);
      console.log(`Último ponto: ${JSON.stringify(formattedData[formattedData.length - 1])}`);
    }

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar dados';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 