-- AlterTable
ALTER TABLE "forum_post_votes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lesson_progress" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "updated_at" DROP DEFAULT;
