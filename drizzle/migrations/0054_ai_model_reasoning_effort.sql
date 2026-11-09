ALTER TABLE "ai_model" ADD COLUMN "reasoning_effort_format" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_model" ADD COLUMN "model_options" text;--> statement-breakpoint
ALTER TABLE "ai_model" ADD CONSTRAINT "ai_model_reasoning_effort_format_check" CHECK ("ai_model"."reasoning_effort_format" in ('none', 'openai', 'openrouter', 'anthropic'));
