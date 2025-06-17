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

async function waitForDatabase(pool, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await pool.query('SELECT 1');
            console.log('Conexão com o banco de dados estabelecida!');
            return true;
        } catch (error) {
            console.log(`Tentativa ${i + 1}/${maxRetries} de conectar ao banco...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Não foi possível conectar ao banco de dados');
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
        await waitForDatabase(pool);

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