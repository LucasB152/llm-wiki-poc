-- CreateEnum
CREATE TYPE "log_operation" AS ENUM ('ingest', 'query');

-- CreateTable
CREATE TABLE "log_entry" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" "log_operation" NOT NULL,
    "subject" TEXT NOT NULL,
    "pages_created" TEXT[],
    "pages_updated" TEXT[],
    "pages_read" TEXT[],

    CONSTRAINT "log_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_entry_created_at_idx" ON "log_entry"("created_at");

-- The journal moves from the wiki/log.md file to the log_entry table
DELETE FROM "wiki_file" WHERE "area" = 'wiki' AND "name" = 'log.md';
