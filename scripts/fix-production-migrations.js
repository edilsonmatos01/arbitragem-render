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

async function fixProductionMigrations() {
    if (!process.env.DATABASE_URL) {
        console.log('⚠️ DATABASE_URL não está definida, pulando correção de migrações');
        return;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔧 Iniciando processo de correção das migrações...');
        
        // Espera o banco estar disponível
        await waitForDatabase();

        // Limpar tabela de migrações corrompidas (se existir)
        try {
            await prisma.$executeRaw`DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%20250613%';`;
            console.log('✅ Migrações corrompidas removidas');
        } catch (error) {
            console.log('ℹ️ Tabela _prisma_migrations não existe ainda ou erro ao limpar:', error.message);
        }

        // Verifica se a tabela _prisma_migrations existe
        const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_name = '_prisma_migrations'
            );
        `;

        if (!tableExists[0].exists) {
            console.log('📋 Tabela _prisma_migrations não existe, marcando como resolvida...');
            // Em produção, assumimos que o banco já está configurado
            // Não executamos migrate deploy para evitar conflitos
            console.log('ℹ️ Em ambiente de produção, assumindo que o banco já está configurado');
        } else {
            console.log('✅ Tabela _prisma_migrations já existe, verificando SpreadHistory...');
            
            // Verificar se a tabela SpreadHistory existe
            const spreadHistoryExists = await prisma.$queryRaw`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'SpreadHistory'
                );
            `;

            if (!spreadHistoryExists[0].exists) {
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
        }

        // Lê e executa o arquivo de migração se existir
        const migrationPath = path.join(__dirname, '../prisma/migrations/20240617_fix_table_name/migration.sql');
        try {
            const migrationSQL = await fs.readFile(migrationPath, 'utf8');
            console.log('📋 Executando migração adicional...');
            await executeQuery(pool, migrationSQL);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('ℹ️ Arquivo de migração adicional não encontrado, continuando...');
            } else {
                throw error;
            }
        }

        console.log('🎉 Processo de correção concluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro durante o processo:', error);
        throw error;
    } finally {
        await pool.end();
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    fixProductionMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { fixProductionMigrations };
