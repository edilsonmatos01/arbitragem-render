// lib/spread-tracker.ts
// Lógica para salvar histórico de spreads e calcular a média nas últimas 24h

import { PrismaClient } from '@prisma/client'
import { normalizeSpread } from '../app/utils/spreadUtils';

// PrismaClient é anexado ao objeto global quando não está em produção
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
    errorFormat: 'minimal',
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

interface SpreadSample {
  symbol: string
  exchangeBuy: string
  exchangeSell: string
  direction: 'spot-to-future' | 'future-to-spot'
  spread: number // Valor em porcentagem (ex: 1.5 para 1.5%)
}

async function waitForDatabase(retries = 5, delay = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

export async function recordSpread(sample: SpreadSample): Promise<void> {
  try {
    // Aguarda o banco estar pronto
    await waitForDatabase();
    
    // Normaliza o spread
    const normalizedSpread = normalizeSpread(sample.spread);
    
    if (normalizedSpread === null) {
      console.warn('Spread inválido, registro ignorado:', sample);
      return;
    }

    // Verifica se a tabela existe
    const tableExists = await prisma.$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spread_history'
      );
    `;

    if (!tableExists[0]?.exists) {
      console.error('Tabela spread_history não existe');
      return;
    }

    await prisma.spreadHistory.create({
      data: {
        symbol: sample.symbol,
        exchangeBuy: sample.exchangeBuy,
        exchangeSell: sample.exchangeSell,
        direction: sample.direction,
        spread: parseFloat(normalizedSpread),
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error recording spread:", error);
    throw error; // Propaga o erro para melhor diagnóstico
  }
}

export async function getAverageSpread24h(
  symbol: string,
  exchangeBuy: string,
  exchangeSell: string,
  direction: 'spot-to-future' | 'future-to-spot'
): Promise<number | null> {
  try {
    await waitForDatabase();
    
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const records = await prisma.spreadHistory.findMany({
      where: {
        symbol,
        exchangeBuy,
        exchangeSell,
        direction,
        timestamp: { gte: since }
      },
      select: {
        spread: true
      }
    })

    if (records.length < 2) return null;

    // Usa Decimal.js para calcular a média com precisão
    const { Decimal } = require('decimal.js');
    const total = records.reduce((sum, r) => sum.plus(r.spread), new Decimal(0));
    const average = total.dividedBy(records.length);
    
    return parseFloat(average.toDecimalPlaces(2).toString());
  } catch (error) {
    console.error("Error getting average spread:", error);
    return null;
  }
}

// Optional: Function to gracefully disconnect Prisma client on app shutdown
export async function disconnectPrisma() {
  await prisma.$disconnect();
} 