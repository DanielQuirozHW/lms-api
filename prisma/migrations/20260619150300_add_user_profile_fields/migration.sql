-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phone" TEXT;
