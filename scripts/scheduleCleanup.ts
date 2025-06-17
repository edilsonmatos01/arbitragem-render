import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

const prisma = new PrismaClient();

async function cleanOldData() {
  try {
    // Calcula a data limite (24 horas atrás)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Excluir registros mais antigos que 24 horas
    const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
      where: {
        timestamp: {
          lt: twentyFourHoursAgo
        }
      }
    });

    console.log(`[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] Registros antigos excluídos: ${deletedSpreadHistory.count}`);
  } catch (error) {
    console.error('Erro ao excluir registros:', error);
  }
}

// Agenda a limpeza para rodar a cada hora
// O '0 * * * *' significa: no minuto 0 de cada hora
cron.schedule('0 * * * *', cleanOldData, {
  timezone: "America/Sao_Paulo"
});

console.log('Limpeza automática agendada. Rodará a cada hora.');

// Mantém o processo rodando
process.stdin.resume(); 