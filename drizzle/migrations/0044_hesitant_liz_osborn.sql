ALTER TABLE "assistant" ADD COLUMN "skill_mode" text DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant" ADD COLUMN "skill_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "skill_mode" text DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "skill_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "transform_agent" ADD COLUMN "skill_mode" text DEFAULT 'dynamic' NOT NULL;--> statement-breakpoint
ALTER TABLE "transform_agent" ADD COLUMN "skill_ids" text[] DEFAULT '{}'::text[] NOT NULL;