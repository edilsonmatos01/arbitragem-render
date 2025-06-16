const { PrismaClient } = require('@prisma/client');

async function fixProductionMigrations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Iniciando correção das migrações...');
    
    // Limpar tabela de migrações corrompidas
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%20250613%';`;
    console.log('✅ Migrações corrompidas removidas');
    
    // Verificar se a tabela SpreadHistory existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SpreadHistory'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log('📋 Criando tabela SpreadHistory...');
      await prisma.$executeRaw`
        CREATE TABLE "SpreadHistory" (
          "id" TEXT NOT NULL,
          "symbol" TEXT NOT NULL,
          "exchangeBuy" TEXT NOT NULL,
          "exchangeSell" TEXT NOT NULL,
          "direction" TEXT NOT NULL,
          "spread" DOUBLE PRECISION NOT NULL,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SpreadHistory_pkey" PRIMARY KEY ("id")
        );
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" 
        ON "SpreadHistory"("symbol", "exchangeBuy", "exchangeSell", "direction");
      `;
      
      console.log('✅ Tabela SpreadHistory criada com sucesso');
    } else {
      console.log('✅ Tabela SpreadHistory já existe');
    }
    
    console.log('🎉 Correção das migrações concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir migrações:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  fixProductionMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { fixProductionMigrations }; 