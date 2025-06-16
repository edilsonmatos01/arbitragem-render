// lib/spread-tracker.ts
// Lógica para salvar histórico de spreads e calcular a média nas últimas 24h

import { PrismaClient } from '@prisma/client'
import { normalizeSpread } from '../app/utils/spreadUtils';

const prisma = new PrismaClient()

interface SpreadSample {
  symbol: string
  exchangeBuy: string
  exchangeSell: string
  direction: 'spot-to-future' | 'future-to-spot'
  spread: number // Valor em porcentagem (ex: 1.5 para 1.5%)
}

// Função para obter o timestamp atual em UTC
function getCurrentUTCTimestamp(): Date {
  const now = new Date();
  return new Date(now.getTime());
}

export async function recordSpread(sample: SpreadSample): Promise<void> {
  try {
    // Normaliza o spread usando a função utilitária
    const normalizedSpread = normalizeSpread(sample.spread);
    
    if (normalizedSpread === null) {
      console.warn('Spread inválido, registro ignorado:', sample);
      return;
    }

    await prisma.spreadHistory.create({
      data: {
        symbol: sample.symbol,
        exchangeBuy: sample.exchangeBuy,
        exchangeSell: sample.exchangeSell,
        direction: sample.direction,
        spread: parseFloat(normalizedSpread),
        timestamp: getCurrentUTCTimestamp() // Usa a função auxiliar para garantir UTC
      }
    });
  } catch (error) {
    console.error("Error recording spread:", error);
  }
}

export async function getAverageSpread24h(
  symbol: string,
  exchangeBuy: string,
  exchangeSell: string,
  direction: 'spot-to-future' | 'future-to-spot'
): Promise<number | null> {
  try {
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