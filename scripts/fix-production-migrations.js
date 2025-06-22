<<<<<<< HEAD
const { exec } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function executeQuery(pool, query) {
    try {
        await pool.query(query);
        console.log('Query executada com sucesso:', query.substring(0, 50) + '...');
        return true;
    } catch (error) {
        console.error('Erro ao executar query:', error.message);
        return false;
    }
}

async function waitForDatabase() {
    for (let i = 1; i <= 15; i++) {
        try {
            console.log(`Tentativa ${i}/15 de conectar ao banco...`);
            await prisma.$connect();
            console.log('Conexão bem sucedida!');
            return;
        } catch (error) {
            console.error(`Tentativa ${i} falhou:`, error.message);
            if (i < 15) {
                // Aumenta o tempo de espera entre tentativas
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
            }
        }
    }
    throw new Error('Não foi possível conectar ao banco de dados após 15 tentativas');
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL não está definida');
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('Iniciando processo de correção das migrações...');
        
        // Espera o banco estar disponível
        await waitForDatabase();

        // Verifica se a tabela _prisma_migrations existe
        const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_name = '_prisma_migrations'
            );
        `;

        if (!tableExists[0].exists) {
            console.log('Tabela _prisma_migrations não existe, executando migrate deploy...');
            // Execute o comando prisma migrate deploy
            const { execSync } = require('child_process');
            execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        } else {
            console.log('Tabela _prisma_migrations já existe, pulando migrate deploy');
        }

        // Lê e executa o arquivo de migração
        const migrationPath = path.join(__dirname, '../prisma/migrations/20240617_fix_table_name/migration.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        console.log('Executando migração...');
        await executeQuery(pool, migrationSQL);

        console.log('Processo de correção concluído com sucesso!');
    } catch (error) {
        console.error('Erro durante o processo:', error);
        process.exit(1);
    } finally {
        await pool.end();
        await prisma.$disconnect();
    }
}

main(); 
=======
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
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
