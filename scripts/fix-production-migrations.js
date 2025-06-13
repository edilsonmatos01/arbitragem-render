const { PrismaClient } = require('@prisma/client');

async function fixProductionMigrations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Iniciando correção das migrações...');
    
    // Criar tabela _prisma_migrations se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum"             VARCHAR(64) NOT NULL,
        "finished_at"          TIMESTAMP WITH TIME ZONE,
        "migration_name"       VARCHAR(255) NOT NULL,
        "logs"                 TEXT,
        "rolled_back_at"       TIMESTAMP WITH TIME ZONE,
        "started_at"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "applied_steps_count"  INTEGER NOT NULL DEFAULT 0
      );
    `);
    
    console.log('✅ Tabela _prisma_migrations verificada/criada');
    
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
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SpreadHistory" (
          "id" TEXT NOT NULL,
          "symbol" TEXT NOT NULL,
          "exchangeBuy" TEXT NOT NULL,
          "exchangeSell" TEXT NOT NULL,
          "direction" TEXT NOT NULL,
          "spread" DOUBLE PRECISION NOT NULL,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SpreadHistory_pkey" PRIMARY KEY ("id")
        );
        
        CREATE INDEX IF NOT EXISTS "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" 
        ON "SpreadHistory"("symbol", "exchangeBuy", "exchangeSell", "direction");
      `);
      
      console.log('✅ Tabela SpreadHistory criada com sucesso');
    } else {
      console.log('✅ Tabela SpreadHistory já existe');
    }
    
    // Registrar a migração na tabela _prisma_migrations
    const migrationId = '20250613164152_init';
    const checksum = 'a1b2c3d4e5f6g7h8i9j0'; // Checksum arbitrário
    
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" 
      ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES (${migrationId}, ${checksum}, NOW(), ${migrationId}, 'Applied manually', NULL, NOW(), 1)
      ON CONFLICT ("id") DO NOTHING;
    `;
    
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