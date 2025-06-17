const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');

async function waitForDatabase(client, retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.query('SELECT 1');
      console.log('Conexão com o banco estabelecida com sucesso');
      return true;
    } catch (error) {
      console.log(`Tentativa ${i + 1} de ${retries} falhou. Aguardando ${delay}ms...`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function createTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Iniciando script de migração...');
    await client.connect();
    console.log('Conectado ao banco de dados');

    // Aguarda o banco estar pronto
    await waitForDatabase(client);
    
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
        DROP TABLE IF EXISTS "spread_history";
        
        CREATE TABLE "spread_history" (
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
    console.log('Testando conexão com Prisma...');
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    // Tenta fazer uma query simples
    const count = await prisma.spreadHistory.count();
    console.log(`Conexão com Prisma estabelecida com sucesso. Registros na tabela: ${count}`);
    
    await prisma.$disconnect();

  } catch (error) {
    console.error('Erro durante a migração:', error);
    throw error;
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