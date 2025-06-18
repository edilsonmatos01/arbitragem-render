const { exec } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

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
        const hasMigrationsTable = await executeQuery(pool, `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = '_prisma_migrations'
            );
        `);

        if (!hasMigrationsTable) {
            console.log('Criando tabela _prisma_migrations...');
            await executeQuery(pool, `
                CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
                    id VARCHAR(36) PRIMARY KEY NOT NULL,
                    checksum VARCHAR(64) NOT NULL,
                    finished_at TIMESTAMP WITH TIME ZONE,
                    migration_name VARCHAR(255) NOT NULL,
                    logs TEXT,
                    rolled_back_at TIMESTAMP WITH TIME ZONE,
                    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                    applied_steps_count INTEGER NOT NULL DEFAULT 0
                );
            `);
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
    }
}

main(); 