-- CreateEnum
CREATE TYPE "log_status" AS ENUM ('success', 'failed');

-- AlterTable
ALTER TABLE "log_entry" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "log_status" NOT NULL DEFAULT 'success';
