-- CreateTable
CREATE TABLE "enrollment_code_usages" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_code_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrollment_code_usages_code_id_idx" ON "enrollment_code_usages"("code_id");

-- CreateIndex
CREATE INDEX "enrollment_code_usages_user_id_idx" ON "enrollment_code_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_code_usages_code_id_user_id_key" ON "enrollment_code_usages"("code_id", "user_id");

-- AddForeignKey
ALTER TABLE "enrollment_code_usages" ADD CONSTRAINT "enrollment_code_usages_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "enrollment_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_code_usages" ADD CONSTRAINT "enrollment_code_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
