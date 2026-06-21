-- ===================================================================
-- standardize_audit_fields
-- Add 6 standard fields to every model:
--   id, createdAt, updatedAt, createdBy, updatedBy, isActive
-- Rename semantic createdAt equivalents:
--   enrolled_at -> created_at (enrollments)
--   submitted_at -> created_at (submissions)
--   started_at -> created_at (quiz_attempts)
--   joined_at -> created_at (course_group_members)
--   used_at -> created_at (enrollment_code_usages)
--   issued_at -> removed (certificates already has created_at)
-- ===================================================================

-- ─── 1. DROP renamed / removed columns ───────────────────────────────────────

ALTER TABLE "enrollments" DROP COLUMN "enrolled_at";
ALTER TABLE "submissions" DROP COLUMN "submitted_at";
ALTER TABLE "quiz_attempts" DROP COLUMN "started_at";
ALTER TABLE "course_group_members" DROP COLUMN "joined_at";
ALTER TABLE "enrollment_code_usages" DROP COLUMN "used_at";
ALTER TABLE "certificates" DROP COLUMN "issued_at";

-- ─── 2. ADD created_at (replaces dropped semantic fields) ────────────────────

ALTER TABLE "enrollments"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "submissions"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "quiz_attempts"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "course_group_members"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "enrollment_code_usages"
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── 3. ADD updated_at to tables that lacked it ──────────────────────────────
-- Use DEFAULT then drop it — Prisma @updatedAt manages the value; no DB default.

ALTER TABLE "certificates"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "certificates" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "lesson_resources"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "lesson_resources" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "rubric_assessment_answers"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "rubric_assessment_answers" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "course_group_members"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "course_group_members" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─── 4. ADD is_active (tables that don't have it; skip exception models) ─────
-- Exceptions (no is_active): system_errors, login_events, password_reset_tokens,
--   impersonation_logs, enrollment_code_usages, quiz_answers, forum_post_votes

ALTER TABLE "assignment_settings"    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "course_group_members"   ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "course_modules"         ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "course_ratings"         ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "course_settings"        ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "courses"                ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "enrollments"            ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "forum_threads"          ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lesson_progress"        ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lesson_resources"       ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lessons"                ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "messages"               ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_settings"  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notifications"          ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "question_options"       ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "questions"              ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "quiz_attempts"          ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "quiz_settings"          ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rubric_assessment_answers" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rubric_assessments"     ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rubric_criteria"        ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rubric_levels"          ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "submissions"            ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- ─── 5. ADD created_by (nullable TEXT, all tables) ───────────────────────────
-- Already has created_by (non-nullable FK): global_announcements — skip

ALTER TABLE "announcements"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "assignment_settings"       ADD COLUMN "created_by" TEXT;
ALTER TABLE "calendar_events"           ADD COLUMN "created_by" TEXT;
ALTER TABLE "categories"                ADD COLUMN "created_by" TEXT;
ALTER TABLE "certificates"              ADD COLUMN "created_by" TEXT;
ALTER TABLE "course_group_members"      ADD COLUMN "created_by" TEXT;
ALTER TABLE "course_groups"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "course_modules"            ADD COLUMN "created_by" TEXT;
ALTER TABLE "course_ratings"            ADD COLUMN "created_by" TEXT;
ALTER TABLE "course_settings"           ADD COLUMN "created_by" TEXT;
ALTER TABLE "courses"                   ADD COLUMN "created_by" TEXT;
ALTER TABLE "enrollment_code_usages"    ADD COLUMN "created_by" TEXT;
ALTER TABLE "enrollment_codes"          ADD COLUMN "created_by" TEXT;
ALTER TABLE "enrollments"               ADD COLUMN "created_by" TEXT;
ALTER TABLE "forum_post_votes"          ADD COLUMN "created_by" TEXT;
ALTER TABLE "forum_posts"               ADD COLUMN "created_by" TEXT;
ALTER TABLE "forum_threads"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "gradebook_categories"      ADD COLUMN "created_by" TEXT;
ALTER TABLE "gradebook_items"           ADD COLUMN "created_by" TEXT;
ALTER TABLE "impersonation_logs"        ADD COLUMN "created_by" TEXT;
ALTER TABLE "lesson_bookmarks"          ADD COLUMN "created_by" TEXT;
ALTER TABLE "lesson_notes"              ADD COLUMN "created_by" TEXT;
ALTER TABLE "lesson_progress"           ADD COLUMN "created_by" TEXT;
ALTER TABLE "lesson_resources"          ADD COLUMN "created_by" TEXT;
ALTER TABLE "lessons"                   ADD COLUMN "created_by" TEXT;
ALTER TABLE "login_events"              ADD COLUMN "created_by" TEXT;
ALTER TABLE "messages"                  ADD COLUMN "created_by" TEXT;
ALTER TABLE "notification_preferences"  ADD COLUMN "created_by" TEXT;
ALTER TABLE "notification_settings"     ADD COLUMN "created_by" TEXT;
ALTER TABLE "notifications"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "password_reset_tokens"     ADD COLUMN "created_by" TEXT;
ALTER TABLE "question_options"          ADD COLUMN "created_by" TEXT;
ALTER TABLE "questions"                 ADD COLUMN "created_by" TEXT;
ALTER TABLE "quiz_answers"              ADD COLUMN "created_by" TEXT;
ALTER TABLE "quiz_attempts"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "quiz_settings"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "rubric_assessment_answers" ADD COLUMN "created_by" TEXT;
ALTER TABLE "rubric_assessments"        ADD COLUMN "created_by" TEXT;
ALTER TABLE "rubric_criteria"           ADD COLUMN "created_by" TEXT;
ALTER TABLE "rubric_levels"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "rubrics"                   ADD COLUMN "created_by" TEXT;
ALTER TABLE "submissions"               ADD COLUMN "created_by" TEXT;
ALTER TABLE "system_errors"             ADD COLUMN "created_by" TEXT;
ALTER TABLE "users"                     ADD COLUMN "created_by" TEXT;

-- ─── 6. ADD updated_by (nullable TEXT) ───────────────────────────────────────
-- Exceptions (no updated_by): system_errors, login_events, password_reset_tokens,
--   impersonation_logs, enrollment_code_usages, quiz_answers, forum_post_votes

ALTER TABLE "announcements"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "assignment_settings"       ADD COLUMN "updated_by" TEXT;
ALTER TABLE "calendar_events"           ADD COLUMN "updated_by" TEXT;
ALTER TABLE "categories"                ADD COLUMN "updated_by" TEXT;
ALTER TABLE "certificates"              ADD COLUMN "updated_by" TEXT;
ALTER TABLE "course_group_members"      ADD COLUMN "updated_by" TEXT;
ALTER TABLE "course_groups"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "course_modules"            ADD COLUMN "updated_by" TEXT;
ALTER TABLE "course_ratings"            ADD COLUMN "updated_by" TEXT;
ALTER TABLE "course_settings"           ADD COLUMN "updated_by" TEXT;
ALTER TABLE "courses"                   ADD COLUMN "updated_by" TEXT;
ALTER TABLE "enrollment_codes"          ADD COLUMN "updated_by" TEXT;
ALTER TABLE "enrollments"               ADD COLUMN "updated_by" TEXT;
ALTER TABLE "forum_posts"               ADD COLUMN "updated_by" TEXT;
ALTER TABLE "forum_threads"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "global_announcements"      ADD COLUMN "updated_by" TEXT;
ALTER TABLE "gradebook_categories"      ADD COLUMN "updated_by" TEXT;
ALTER TABLE "gradebook_items"           ADD COLUMN "updated_by" TEXT;
ALTER TABLE "lesson_bookmarks"          ADD COLUMN "updated_by" TEXT;
ALTER TABLE "lesson_notes"              ADD COLUMN "updated_by" TEXT;
ALTER TABLE "lesson_progress"           ADD COLUMN "updated_by" TEXT;
ALTER TABLE "lesson_resources"          ADD COLUMN "updated_by" TEXT;
ALTER TABLE "lessons"                   ADD COLUMN "updated_by" TEXT;
ALTER TABLE "messages"                  ADD COLUMN "updated_by" TEXT;
ALTER TABLE "notification_preferences"  ADD COLUMN "updated_by" TEXT;
ALTER TABLE "notification_settings"     ADD COLUMN "updated_by" TEXT;
ALTER TABLE "notifications"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "question_options"          ADD COLUMN "updated_by" TEXT;
ALTER TABLE "questions"                 ADD COLUMN "updated_by" TEXT;
ALTER TABLE "quiz_attempts"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "quiz_settings"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "rubric_assessment_answers" ADD COLUMN "updated_by" TEXT;
ALTER TABLE "rubric_assessments"        ADD COLUMN "updated_by" TEXT;
ALTER TABLE "rubric_criteria"           ADD COLUMN "updated_by" TEXT;
ALTER TABLE "rubric_levels"             ADD COLUMN "updated_by" TEXT;
ALTER TABLE "rubrics"                   ADD COLUMN "updated_by" TEXT;
ALTER TABLE "submissions"               ADD COLUMN "updated_by" TEXT;
ALTER TABLE "users"                     ADD COLUMN "updated_by" TEXT;
