-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "preferred_theme" TEXT NOT NULL DEFAULT 'dark';
