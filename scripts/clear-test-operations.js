const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearOperations() {
  try {
    console.log('🧹 Limpando dados de teste do banco...');

    // Deletar todas as operações de teste
    const result = await prisma.operationHistory.deleteMany({});
    
    console.log(`✅ ${result.count} operações removidas com sucesso!`);
    console.log('📊 Banco limpo - pronto para operações reais');

  } catch (error) {
    console.error('❌ Erro ao limpar operações:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearOperations(); 