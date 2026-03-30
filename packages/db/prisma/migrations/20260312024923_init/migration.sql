-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertSound" BOOLEAN NOT NULL DEFAULT true,
    "alertBrowserPush" BOOLEAN NOT NULL DEFAULT false,
    "defaultView" TEXT NOT NULL DEFAULT 'active',
    "priceCheckIntervalSec" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachPost" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "imageStoragePaths" TEXT[],
    "imageAnalysis" JSONB,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestionMethod" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "CoachPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedTrade" (
    "id" TEXT NOT NULL,
    "coachPostId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'long',
    "priceTargetLow" DOUBLE PRECISION,
    "priceTargetHigh" DOUBLE PRECISION,
    "priceTargetPercent" DOUBLE PRECISION,
    "priceConfirmation" DOUBLE PRECISION,
    "projectedDate" TIMESTAMP(3),
    "stopLoss" DOUBLE PRECISION,
    "supportLevel" DOUBLE PRECISION,
    "resistanceLevel" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sourceType" TEXT NOT NULL DEFAULT 'text',
    "rawExtract" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "parsedTradeId" TEXT,
    "coachPostId" TEXT,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'watching',

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "parsedTradeId" TEXT,
    "entryPrice" DOUBLE PRECISION,
    "entryDate" TIMESTAMP(3),
    "priceConfirmation" DOUBLE PRECISION,
    "priceTargetHigh" DOUBLE PRECISION,
    "priceTargetLow" DOUBLE PRECISION,
    "projectedDate" TIMESTAMP(3),
    "stopLoss" DOUBLE PRECISION,
    "supportLevel" DOUBLE PRECISION,
    "resistanceLevel" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentPrice" DOUBLE PRECISION,
    "currentPriceUpdatedAt" TIMESTAMP(3),
    "profitLoss" DOUBLE PRECISION,
    "closedAt" TIMESTAMP(3),
    "closedPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeTradeId" TEXT,
    "ticker" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "triggerPrice" DOUBLE PRECISION,
    "triggeredAt" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedTag" (
    "id" TEXT NOT NULL,
    "coachPostId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "ticker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachPost_externalId_key" ON "CoachPost"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_ticker_key" ON "WatchlistItem"("userId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "FeedTag_coachPostId_tagType_ticker_key" ON "FeedTag"("coachPostId", "tagType", "ticker");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedTrade" ADD CONSTRAINT "ParsedTrade_coachPostId_fkey" FOREIGN KEY ("coachPostId") REFERENCES "CoachPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_parsedTradeId_fkey" FOREIGN KEY ("parsedTradeId") REFERENCES "ParsedTrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_coachPostId_fkey" FOREIGN KEY ("coachPostId") REFERENCES "CoachPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTrade" ADD CONSTRAINT "ActiveTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTrade" ADD CONSTRAINT "ActiveTrade_parsedTradeId_fkey" FOREIGN KEY ("parsedTradeId") REFERENCES "ParsedTrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_activeTradeId_fkey" FOREIGN KEY ("activeTradeId") REFERENCES "ActiveTrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTag" ADD CONSTRAINT "FeedTag_coachPostId_fkey" FOREIGN KEY ("coachPostId") REFERENCES "CoachPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
