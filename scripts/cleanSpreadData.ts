const { PrismaClient } = require('@prisma/client');

async function cleanSpreadData() {
  const prisma = new PrismaClient();

  try {
    // Excluir registros da tabela spreadHistory
    const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
      where: {
        timestamp: {
          gte: new Date('2025-06-12T00:00:00Z'),
          lt: new Date('2025-06-12T21:30:00Z') // 18:30 BRT = 21:30 UTC
        }
      }
    });

    console.log(`Registros excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
  } catch (error) {
    console.error('Erro ao excluir registros:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanSpreadData(); 