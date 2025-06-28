-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "spotEntry" DOUBLE PRECISION NOT NULL,
    "futuresEntry" DOUBLE PRECISION NOT NULL,
    "spotExchange" TEXT NOT NULL,
    "futuresExchange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "Position"("symbol");
