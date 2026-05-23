-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('ASSIGNMENT_DUE', 'QUIZ_DUE', 'LESSON_AVAILABLE', 'COURSE_START', 'COURSE_END', 'CUSTOM');

-- AlterTable
ALTER TABLE "assignment_settings" ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "is_group_assignment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "final_grade" DOUBLE PRECISION,
ADD COLUMN     "graded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "rubric_id" TEXT;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "group_id" TEXT;

-- CreateTable
CREATE TABLE "gradebook_categories" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "gradebook_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gradebook_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION NOT NULL,
    "is_extra_credit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gradebook_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "total_points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "rubric_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_levels" (
    "id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "rubric_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_assessments" (
    "id" TEXT NOT NULL,
    "rubric_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "assessor_id" TEXT NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubric_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_assessment_answers" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "level_id" TEXT,
    "points_awarded" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,

    CONSTRAINT "rubric_assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_groups" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_members" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "course_id" TEXT,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gradebook_categories_course_id_idx" ON "gradebook_categories"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "gradebook_categories_course_id_name_key" ON "gradebook_categories"("course_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "gradebook_items_lesson_id_key" ON "gradebook_items"("lesson_id");

-- CreateIndex
CREATE INDEX "gradebook_items_category_id_idx" ON "gradebook_items"("category_id");

-- CreateIndex
CREATE INDEX "rubrics_course_id_idx" ON "rubrics"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criteria_rubric_id_order_key" ON "rubric_criteria"("rubric_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_levels_criterion_id_order_key" ON "rubric_levels"("criterion_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_assessments_submission_id_key" ON "rubric_assessments"("submission_id");

-- CreateIndex
CREATE INDEX "rubric_assessments_rubric_id_idx" ON "rubric_assessments"("rubric_id");

-- CreateIndex
CREATE INDEX "rubric_assessments_assessor_id_idx" ON "rubric_assessments"("assessor_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_assessment_answers_assessment_id_criterion_id_key" ON "rubric_assessment_answers"("assessment_id", "criterion_id");

-- CreateIndex
CREATE INDEX "course_groups_course_id_idx" ON "course_groups"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_groups_course_id_name_key" ON "course_groups"("course_id", "name");

-- CreateIndex
CREATE INDEX "course_group_members_group_id_idx" ON "course_group_members"("group_id");

-- CreateIndex
CREATE INDEX "course_group_members_user_id_idx" ON "course_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_group_members_group_id_user_id_key" ON "course_group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "calendar_events_course_id_idx" ON "calendar_events"("course_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_idx" ON "calendar_events"("user_id");

-- CreateIndex
CREATE INDEX "calendar_events_start_date_idx" ON "calendar_events"("start_date");

-- CreateIndex
CREATE INDEX "assignment_settings_group_id_idx" ON "assignment_settings"("group_id");

-- CreateIndex
CREATE INDEX "submissions_group_id_idx" ON "submissions"("group_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_settings" ADD CONSTRAINT "assignment_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "course_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "gradebook_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_levels" ADD CONSTRAINT "rubric_levels_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessments" ADD CONSTRAINT "rubric_assessments_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessments" ADD CONSTRAINT "rubric_assessments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessments" ADD CONSTRAINT "rubric_assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessment_answers" ADD CONSTRAINT "rubric_assessment_answers_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "rubric_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessment_answers" ADD CONSTRAINT "rubric_assessment_answers_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_assessment_answers" ADD CONSTRAINT "rubric_assessment_answers_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "rubric_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_group_members" ADD CONSTRAINT "course_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "course_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_group_members" ADD CONSTRAINT "course_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
