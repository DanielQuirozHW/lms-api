-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'GRADING', 'GRADED', 'RETURNED');

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED';
