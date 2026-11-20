ALTER TABLE "assistant" RENAME TO "agent";--> statement-breakpoint
ALTER INDEX IF EXISTS "assistant_user_id_idx" RENAME TO "agent_user_id_idx";--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "subagent_prompt" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "knowledgebase_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "subagent_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "guardrails" jsonb DEFAULT '{"maxSteps":10,"scratchpadAccess":"read_write","isolateTools":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat" RENAME COLUMN "assistant_id" TO "agent_id";--> statement-breakpoint
ALTER TABLE "skill" RENAME COLUMN "assistant_ids" TO "agent_ids";--> statement-breakpoint
ALTER INDEX IF EXISTS "skill_assistant_ids_idx" RENAME TO "skill_agent_ids_idx";--> statement-breakpoint
ALTER TABLE "prompt" RENAME COLUMN "assistant_ids" TO "agent_ids";--> statement-breakpoint
ALTER INDEX IF EXISTS "prompt_assistant_ids_idx" RENAME TO "prompt_agent_ids_idx";--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "subagent_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "transform_agent" ADD COLUMN "subagent_ids" text[] DEFAULT '{}'::text[] NOT NULL;
