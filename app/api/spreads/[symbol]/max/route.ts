import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

<<<<<<< HEAD
let prisma: PrismaClient | null = null;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Aviso: Não foi possível conectar ao banco de dados');
}

// Configuração para tornar a rota dinâmica
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Temporariamente retornando valores nulos para limpar os gráficos
=======
const prisma = new PrismaClient();

>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;

  if (!symbol) {
    return NextResponse.json({ error: 'O símbolo é obrigatório' }, { status: 400 });
  }

<<<<<<< HEAD
  // Se não houver conexão com o banco, retorna valores nulos
  if (!prisma) {
    console.warn('Aviso: Banco de dados não disponível');
    return NextResponse.json({ spMax: null, crosses: 0 });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

=======
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
    return NextResponse.json({ spMax: null, crosses: 0 });
=======
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
  }
} 