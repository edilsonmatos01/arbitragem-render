const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
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

    console.log('Migração aplicada com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migração:', error);
  } finally {
    await client.end();
  }
}

main(); 