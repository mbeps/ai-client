ALTER TABLE "prompt" ADD COLUMN "project_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "prompt" SET "project_ids" = ARRAY["project_id"] WHERE "project_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt" DROP CONSTRAINT IF EXISTS "prompt_project_id_project_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "prompt_project_id_idx";--> statement-breakpoint
ALTER TABLE "prompt" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
ALTER TABLE "prompt" ADD COLUMN "assistant_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "prompt" SET "assistant_ids" = ARRAY["assistant_id"] WHERE "assistant_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt" DROP CONSTRAINT IF EXISTS "prompt_assistant_id_assistant_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "prompt_assistant_id_idx";--> statement-breakpoint
ALTER TABLE "prompt" DROP COLUMN IF EXISTS "assistant_id";--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "project_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "skill" SET "project_ids" = ARRAY["project_id"] WHERE "project_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "skill" DROP CONSTRAINT IF EXISTS "skill_project_id_project_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "skill_project_id_idx";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "assistant_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "skill" SET "assistant_ids" = ARRAY["assistant_id"] WHERE "assistant_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "skill" DROP CONSTRAINT IF EXISTS "skill_assistant_id_assistant_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "skill_assistant_id_idx";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN IF EXISTS "assistant_id";
