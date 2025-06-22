-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gateioSpotAsk" DOUBLE PRECISION NOT NULL,
    "gateioSpotBid" DOUBLE PRECISION NOT NULL,
    "mexcSpotAsk" DOUBLE PRECISION NOT NULL,
    "mexcSpotBid" DOUBLE PRECISION NOT NULL,
    "gateioFuturesAsk" DOUBLE PRECISION NOT NULL,
    "gateioFuturesBid" DOUBLE PRECISION NOT NULL,
    "mexcFuturesAsk" DOUBLE PRECISION NOT NULL,
    "mexcFuturesBid" DOUBLE PRECISION NOT NULL,
    "gateioSpotToMexcFuturesSpread" DOUBLE PRECISION NOT NULL,
    "mexcSpotToGateioFuturesSpread" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradableSymbol" (
    "id" TEXT NOT NULL,
    "baseSymbol" TEXT NOT NULL,
    "gateioSymbol" TEXT NOT NULL,
    "mexcSymbol" TEXT NOT NULL,
    "gateioFuturesSymbol" TEXT NOT NULL,
    "mexcFuturesSymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradableSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceHistory_symbol_timestamp_idx" ON "PriceHistory"("symbol", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TradableSymbol_baseSymbol_key" ON "TradableSymbol"("baseSymbol");

-- CreateIndex
CREATE INDEX "TradableSymbol_baseSymbol_idx" ON "TradableSymbol"("baseSymbol");
