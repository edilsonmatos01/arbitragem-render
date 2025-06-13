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
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          id TEXT PRIMARY KEY NOT NULL,
          checksum TEXT NOT NULL,
          finished_at DATETIME,
          migration_name TEXT NOT NULL,
          logs TEXT,
          rolled_back_at DATETIME,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          applied_steps_count INTEGER NOT NULL DEFAULT 0
        );
      `);
      console.log('✅ Tabela _prisma_migrations verificada/criada');
    } catch (e) {
      console.error('❌ Erro ao criar tabela _prisma_migrations:', e);
      throw e;
    }
    
    // Dropar a tabela SpreadHistory se existir
    try {
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "SpreadHistory";');
      console.log('✅ Tabela SpreadHistory removida (se existia)');
    } catch (e) {
      console.error('❌ Erro ao dropar tabela SpreadHistory:', e);
      // Não vamos lançar o erro aqui, pois não é crítico
    }
    
    // Criar tabela SpreadHistory
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "SpreadHistory" (
          id TEXT PRIMARY KEY NOT NULL,
          symbol TEXT NOT NULL,
          exchangeBuy TEXT NOT NULL,
          exchangeSell TEXT NOT NULL,
          direction TEXT NOT NULL,
          spread REAL NOT NULL,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tabela SpreadHistory criada');
    } catch (e) {
      console.error('❌ Erro ao criar tabela SpreadHistory:', e);
      throw e;
    }
    
    // Criar índice para SpreadHistory
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" 
        ON "SpreadHistory"(symbol, exchangeBuy, exchangeSell, direction);
      `);
      console.log('✅ Índice criado para SpreadHistory');
    } catch (e) {
      console.error('❌ Erro ao criar índice para SpreadHistory:', e);
      throw e;
    }
    
    // Registrar a migração na tabela _prisma_migrations como concluída
    try {
      const migrationId = '20250613164152_init';
      const checksum = 'a1b2c3d4e5f6g7h8i9j0'; // Checksum arbitrário
      
      await prisma.$executeRawUnsafe(`
        INSERT OR REPLACE INTO "_prisma_migrations" 
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (
          '${migrationId}', 
          '${checksum}', 
          CURRENT_TIMESTAMP, 
          '${migrationId}', 
          'Applied manually via fix script', 
          NULL, 
          CURRENT_TIMESTAMP, 
          1
        );
      `);
      console.log('✅ Migração registrada com sucesso');
    } catch (e) {
      console.error('❌ Erro ao registrar migração:', e);
      throw e;
    }
    
    console.log('✅ Correção das migrações concluída com sucesso!');
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