import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('Erro ao conectar com o banco:', error);
}

// GET - Buscar histórico de operações com filtros
export async function GET(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || '24h'; // 24h, day, range
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const symbol = searchParams.get('symbol');

    let whereCondition: any = {};

    // Filtro por símbolo
    if (symbol) {
      whereCondition.symbol = symbol;
    }

    // Filtros de data
    const now = new Date();
    switch (filter) {
      case '24h':
        whereCondition.finalizedAt = {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        };
        break;
      case 'day':
        if (startDate) {
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(startDate);
          dayEnd.setHours(23, 59, 59, 999);
          whereCondition.finalizedAt = {
            gte: dayStart,
            lte: dayEnd
          };
        }
        break;
      case 'range':
        if (startDate && endDate) {
          whereCondition.finalizedAt = {
            gte: new Date(startDate),
            lte: new Date(endDate)
          };
        }
        break;
    }

    const operations = await prisma.operationHistory.findMany({
      where: whereCondition,
      orderBy: { finalizedAt: 'desc' },
      take: 100 // Limita a 100 registros
    });

    return NextResponse.json(operations);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar novo registro no histórico
export async function POST(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const body = await req.json();
    const {
      symbol,
      quantity,
      spotEntryPrice,
      futuresEntryPrice,
      spotExitPrice,
      futuresExitPrice,
      spotExchange,
      futuresExchange,
      profitLossUsd,
      profitLossPercent,
      createdAt
    } = body;

    if (!symbol || !quantity || !spotEntryPrice || !futuresEntryPrice || 
        !spotExitPrice || !futuresExitPrice || !spotExchange || !futuresExchange) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const operation = await prisma.operationHistory.create({
      data: {
        symbol,
        quantity,
        spotEntryPrice,
        futuresEntryPrice,
        spotExitPrice,
        futuresExitPrice,
        spotExchange,
        futuresExchange,
        profitLossUsd,
        profitLossPercent,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        finalizedAt: new Date()
      }
    });

    return NextResponse.json(operation);
  } catch (error) {
    console.error('Erro ao criar registro no histórico:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
} 