-- CreateEnum
CREATE TYPE "file_area" AS ENUM ('raw', 'wiki', 'schema');

-- CreateTable
CREATE TABLE "wiki_file" (
    "id" UUID NOT NULL,
    "area" "file_area" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_file_area_name_key" ON "wiki_file"("area", "name");
