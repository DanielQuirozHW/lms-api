-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('FREE', 'ASSIGNED', 'CODE', 'PAID');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "enrollment_type" "EnrollmentType" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "enrollment_codes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_codes_code_key" ON "enrollment_codes"("code");

-- CreateIndex
CREATE INDEX "enrollment_codes_course_id_idx" ON "enrollment_codes"("course_id");

-- CreateIndex
CREATE INDEX "enrollment_codes_code_idx" ON "enrollment_codes"("code");

-- AddForeignKey
ALTER TABLE "enrollment_codes" ADD CONSTRAINT "enrollment_codes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
