-- Drop existing tables if they exist
DROP TABLE IF EXISTS "SpreadHistory";
DROP TABLE IF EXISTS "spread_history";

-- CreateTable
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

-- CreateIndex
CREATE INDEX "spread_history_symbol_timestamp_idx" ON "spread_history"("symbol", "timestamp"); 