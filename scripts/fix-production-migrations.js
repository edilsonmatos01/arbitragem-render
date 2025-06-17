const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');

async function createTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Conectado ao banco de dados');
    
    // Verifica se a tabela já existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spread_history'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Criando tabela spread_history...');
      
      // Criar a tabela spread_history
      await client.query(`
        CREATE TABLE IF NOT EXISTS "spread_history" (
          "id" TEXT NOT NULL,
          "symbol" TEXT NOT NULL,
          "exchangeBuy" TEXT NOT NULL,
          "exchangeSell" TEXT NOT NULL,
          "direction" TEXT NOT NULL,
          "spread" DOUBLE PRECISION NOT NULL,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "spread_history_pkey" PRIMARY KEY ("id")
        );
      `);

      // Criar o índice
      await client.query(`
        CREATE INDEX IF NOT EXISTS "spread_history_symbol_timestamp_idx" 
        ON "spread_history"("symbol", "timestamp");
      `);

      console.log('Tabela e índice criados com sucesso!');
    } else {
      console.log('Tabela spread_history já existe');
    }

    // Verifica se o Prisma consegue se conectar
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('Conexão com Prisma estabelecida com sucesso');
    await prisma.$disconnect();

  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Se o script for executado diretamente
if (require.main === module) {
  createTable()
    .then(() => {
      console.log('Script de migração concluído com sucesso');
      process.exit(0);
    })
    .catch(error => {
      console.error('Erro no script de migração:', error);
      process.exit(1);
    });
} 