-- Primeiro, verifica se a tabela existe e dropa se existir
DROP TABLE IF EXISTS "spread_history";

-- Cria a tabela com a estrutura correta
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

-- Cria o índice necessário
CREATE INDEX "spread_history_symbol_timestamp_idx" ON "spread_history"("symbol", "timestamp");

-- Adiciona a tabela ao _prisma_migrations se não existir
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT 
    '20240617_fix_table_name',
    'a123456789abcdef',
    CURRENT_TIMESTAMP,
    '20240617_fix_table_name',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20240617_fix_table_name'
); 