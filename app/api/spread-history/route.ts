import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Temporariamente retornando array vazio para limpar os gráficos
export async function GET(req: NextRequest) {
  return NextResponse.json([]);
} 