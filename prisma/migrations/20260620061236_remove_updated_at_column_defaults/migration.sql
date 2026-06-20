-- AlterTable
ALTER TABLE "assignment_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "course_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "enrollment_codes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gradebook_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gradebook_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "impersonation_logs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lesson_bookmarks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "question_options" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quiz_attempts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quiz_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rubric_assessments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rubric_criteria" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rubric_levels" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "submissions" ALTER COLUMN "updated_at" DROP DEFAULT;
