-- CreateTable
CREATE TABLE "system_errors" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "userId" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_errors_created_at_idx" ON "system_errors"("created_at");

-- CreateIndex
CREATE INDEX "system_errors_statusCode_idx" ON "system_errors"("statusCode");
