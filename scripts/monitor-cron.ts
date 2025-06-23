import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function checkLastRecord() {
  try {
    // Busca o último registro
    const lastRecord = await prisma.spreadHistory.findFirst({
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!lastRecord) {
      console.log('Nenhum registro encontrado no banco de dados');
      return false;
    }

    // Verifica se o último registro tem mais de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (lastRecord.timestamp < tenMinutesAgo) {
      console.log('Último registro tem mais de 10 minutos:', lastRecord.timestamp);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao verificar registros:', error);
    return false;
  }
}

async function restartCronJob() {
  try {
    console.log('Tentando reiniciar o cronjob...');
    
    // Executa o script de coleta de spreads
    await execAsync('node dist/scripts/store-spreads.js');
    
    console.log('Cronjob reiniciado com sucesso');
  } catch (error) {
    console.error('Erro ao reiniciar cronjob:', error);
    
    // Envia notificação de erro (você pode implementar seu método preferido de notificação)
    console.error('ALERTA: Falha ao reiniciar cronjob. Necessária intervenção manual.');
  }
}

async function monitor() {
  console.log('Iniciando monitoramento...');
  
  while (true) {
    const isHealthy = await checkLastRecord();
    
    if (!isHealthy) {
      console.log('Detectada possível falha no cronjob');
      await restartCronJob();
    }
    
    // Aguarda 5 minutos antes da próxima verificação
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  }
}

// Inicia o monitoramento
monitor().catch(console.error); 