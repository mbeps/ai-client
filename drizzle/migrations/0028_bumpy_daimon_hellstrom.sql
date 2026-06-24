CREATE TABLE "ai_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text,
	"headers" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"requires_key" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"label" text NOT NULL,
	"model_type" text DEFAULT 'chat' NOT NULL,
	"context_window" integer DEFAULT 4096 NOT NULL,
	"embedding_dimensions" integer,
	"cap_tools" boolean DEFAULT false NOT NULL,
	"cap_vision" boolean DEFAULT false NOT NULL,
	"cap_reasoning" boolean DEFAULT false NOT NULL,
	"cap_structured_output" boolean DEFAULT false NOT NULL,
	"is_manually_added" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_model_type_check" CHECK ("ai_model"."model_type" in ('chat', 'embedding', 'both'))
);
--> statement-breakpoint
ALTER TABLE "kb_chunk" ALTER COLUMN "embedding" SET DATA TYPE vector;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "default_chat_model_id" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "default_embedding_model_id" text;--> statement-breakpoint
ALTER TABLE "ai_provider" ADD CONSTRAINT "ai_provider_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model" ADD CONSTRAINT "ai_model_provider_id_ai_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model" ADD CONSTRAINT "ai_model_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_user_id_idx" ON "ai_provider" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_user_id_name_idx" ON "ai_provider" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "ai_model_provider_id_idx" ON "ai_model" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "ai_model_user_id_idx" ON "ai_model" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_model_user_id_model_type_idx" ON "ai_model" USING btree ("user_id","model_type");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_provider_id_model_id_idx" ON "ai_model" USING btree ("provider_id","model_id");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_chat_model_id_ai_model_id_fk" FOREIGN KEY ("default_chat_model_id") REFERENCES "public"."ai_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_embedding_model_id_ai_model_id_fk" FOREIGN KEY ("default_embedding_model_id") REFERENCES "public"."ai_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "openrouter_key";