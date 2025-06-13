-- CreateTable
CREATE TABLE "SpreadHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "exchangeBuy" TEXT NOT NULL,
    "exchangeSell" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "spread" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" ON "SpreadHistory"("symbol", "exchangeBuy", "exchangeSell", "direction");
