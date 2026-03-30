-- CreateTable
CREATE TABLE "CoachProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system_detected',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParseFeedback" (
    "id" TEXT NOT NULL,
    "coachPostId" TEXT NOT NULL,
    "parsedTradeId" TEXT,
    "feedbackText" TEXT NOT NULL,
    "correctionType" TEXT,
    "fieldsCorrected" TEXT[],
    "originalValues" JSONB,
    "correctedValues" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParseFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_key_key" ON "CoachProfile"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_key_key" ON "KnowledgeEntry"("key");

-- AddForeignKey
ALTER TABLE "ParseFeedback" ADD CONSTRAINT "ParseFeedback_coachPostId_fkey" FOREIGN KEY ("coachPostId") REFERENCES "CoachPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParseFeedback" ADD CONSTRAINT "ParseFeedback_parsedTradeId_fkey" FOREIGN KEY ("parsedTradeId") REFERENCES "ParsedTrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
