import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;

  if (!symbol) {
    return NextResponse.json({ error: 'O símbolo é obrigatório' }, { status: 400 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const records = await prisma.spreadHistory.findMany({
      where: {
        symbol: symbol,
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        spread: true,
      },
    });

    if (records.length < 2) {
      return NextResponse.json({ spMax: null, crosses: 0 });
    }

    const spreads = records.map(r => r.spread);
    const maxSpread = Math.max(...spreads);

    return NextResponse.json({
      spMax: maxSpread,
      crosses: records.length
    });

  } catch (error) {
    console.error(`Erro ao buscar estatísticas para o símbolo ${symbol}:`, error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
} 