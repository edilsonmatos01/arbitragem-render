const { PrismaClient } = require('@prisma/client');

async function fixProductionMigrations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Iniciando correção das migrações...');
    
    // Primeiro, vamos limpar qualquer migração com falha
    try {
      await prisma.$executeRawUnsafe(
        'DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL OR applied_steps_count = 0;'
      );
      console.log('✅ Limpeza de migrações com falha concluída');
    } catch (e) {
      console.log('Tabela _prisma_migrations ainda não existe');
    }
    
    // Criar tabela _prisma_migrations se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP WITH TIME ZONE,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);
    console.log('✅ Tabela _prisma_migrations verificada/criada');
    
    // Dropar a tabela SpreadHistory se existir
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "SpreadHistory" CASCADE;');
    console.log('✅ Tabela SpreadHistory removida (se existia)');
    
    // Criar tabela SpreadHistory
    await prisma.$executeRawUnsafe(`
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
    `);
    console.log('✅ Tabela SpreadHistory criada');
    
    // Criar índice para SpreadHistory
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" 
      ON "SpreadHistory"("symbol", "exchangeBuy", "exchangeSell", "direction");
    `);
    console.log('✅ Índice criado para SpreadHistory');
    
    // Registrar a migração na tabela _prisma_migrations como concluída
    const migrationId = '20250613164152_init';
    const checksum = 'a1b2c3d4e5f6g7h8i9j0'; // Checksum arbitrário
    
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" 
      ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES (${migrationId}, ${checksum}, NOW(), ${migrationId}, 'Applied manually via fix script', NULL, NOW(), 1)
      ON CONFLICT ("id") DO UPDATE 
      SET 
        "finished_at" = NOW(),
        "rolled_back_at" = NULL,
        "applied_steps_count" = 1,
        "logs" = 'Re-applied manually via fix script';
    `;
    console.log('✅ Migração registrada com sucesso');
    
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