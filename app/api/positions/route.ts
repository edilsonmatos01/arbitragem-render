import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Buscar todas as posições
export async function GET(req: NextRequest) {
  try {
    if (!prisma) {
      console.warn('Aviso: Banco de dados não disponível');
      return NextResponse.json([]);
    }

    const positions = await prisma.position.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error('Erro ao buscar posições:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova posição
export async function POST(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const body = await req.json();
    const { symbol, quantity, spotEntry, futuresEntry, spotExchange, futuresExchange, isSimulated } = body;

    if (!symbol || !quantity || !spotEntry || !futuresEntry || !spotExchange || !futuresExchange) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const position = await prisma.position.create({
      data: {
        symbol,
        quantity,
        spotEntry,
        futuresEntry,
        spotExchange,
        futuresExchange,
        isSimulated: isSimulated || false
      }
    });

    return NextResponse.json(position);
  } catch (error) {
    console.error('Erro ao criar posição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Remover posição
export async function DELETE(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da posição é obrigatório' }, { status: 400 });
    }

    await prisma.position.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Posição removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover posição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
} 