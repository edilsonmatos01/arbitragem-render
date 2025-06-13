-- CreateTable
CREATE TABLE "SpreadHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeBuy" TEXT NOT NULL,
    "exchangeSell" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "spread" DOUBLE PRECISION NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "futuresPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpreadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpreadHistory_symbol_exchangeBuy_exchangeSell_direction_idx" ON "SpreadHistory"("symbol", "exchangeBuy", "exchangeSell", "direction");
