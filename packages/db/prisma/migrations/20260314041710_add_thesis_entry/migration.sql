-- CreateTable
CREATE TABLE "ThesisEntry" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT,
    "rawText" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "extractedKeys" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThesisEntry_pkey" PRIMARY KEY ("id")
);
