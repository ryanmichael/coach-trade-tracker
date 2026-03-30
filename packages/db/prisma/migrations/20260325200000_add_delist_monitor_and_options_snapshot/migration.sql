-- CreateTable
CREATE TABLE "DelistMonitorTicker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'green',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "DelistMonitorTicker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelistCheckResult" (
    "id" TEXT NOT NULL,
    "delistMonitorTickerId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "signalLevel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawData" JSONB,
    "url" TEXT,

    CONSTRAINT "DelistCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionsSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "projectedDate" TIMESTAMP(3) NOT NULL,
    "contractTicker" TEXT NOT NULL,
    "strike" DOUBLE PRECISION NOT NULL,
    "expiry" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "askAtRec" DOUBLE PRECISION NOT NULL,
    "forwardROI" DOUBLE PRECISION NOT NULL,
    "compositeScore" DOUBLE PRECISION NOT NULL,
    "ivEstimate" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "isBestMatch" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualOptionPrice" DOUBLE PRECISION,
    "stockPriceAtCheck" DOUBLE PRECISION,
    "actualROI" DOUBLE PRECISION,
    "predictionError" DOUBLE PRECISION,
    "directionCorrect" BOOLEAN,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "OptionsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelistMonitorTicker_userId_ticker_key" ON "DelistMonitorTicker"("userId", "ticker");

-- CreateIndex
CREATE INDEX "OptionsSnapshot_ticker_createdAt_idx" ON "OptionsSnapshot"("ticker", "createdAt");

-- CreateIndex
CREATE INDEX "OptionsSnapshot_sessionId_idx" ON "OptionsSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "OptionsSnapshot_validatedAt_idx" ON "OptionsSnapshot"("validatedAt");

-- AddForeignKey
ALTER TABLE "DelistMonitorTicker" ADD CONSTRAINT "DelistMonitorTicker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelistCheckResult" ADD CONSTRAINT "DelistCheckResult_delistMonitorTickerId_fkey" FOREIGN KEY ("delistMonitorTickerId") REFERENCES "DelistMonitorTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
