import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOldData() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 horas atrás

  // Exclui da tabela SpreadHistory
  const spreadResult = await prisma.spreadHistory.deleteMany({
    where: {
      timestamp: {
        lt: cutoff,
      },
    },
  });

  // Exclui da tabela PriceHistory
  const priceResult = await prisma.priceHistory.deleteMany({
    where: {
      timestamp: {
        lt: cutoff,
      },
    },
  });

  console.log(`Registros excluídos de SpreadHistory: ${spreadResult.count}`);
  console.log(`Registros excluídos de PriceHistory: ${priceResult.count}`);

  await prisma.$disconnect();
}

cleanupOldData().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
}); 