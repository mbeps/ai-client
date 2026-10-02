CREATE TABLE "workflow_translation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"source_text" text DEFAULT '' NOT NULL,
	"translated_text" text DEFAULT '' NOT NULL,
	"model_id" text,
	"attachment_name" text,
	"attachment_type" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "verified" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "workflow_translation" ADD CONSTRAINT "workflow_translation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_translation_user_id_idx" ON "workflow_translation" USING btree ("user_id");