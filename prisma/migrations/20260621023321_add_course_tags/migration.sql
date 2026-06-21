-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
