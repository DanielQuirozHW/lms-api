-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "level" "CourseLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "what_you_will_learn" TEXT[];
