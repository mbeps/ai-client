CREATE TABLE "transform_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"model_id" text,
	"steps" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transform_run" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step_index" integer,
	"dry_run" boolean DEFAULT false NOT NULL,
	"input_attachment_ids" text DEFAULT '[]' NOT NULL,
	"output_attachment_ids" text DEFAULT '[]' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "transform_run_id" text;--> statement-breakpoint
ALTER TABLE "transform_agent" ADD CONSTRAINT "transform_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transform_run" ADD CONSTRAINT "transform_run_agent_id_transform_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."transform_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transform_run" ADD CONSTRAINT "transform_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transform_agent_user_id_idx" ON "transform_agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transform_run_agent_id_idx" ON "transform_run" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "transform_run_user_id_idx" ON "transform_run" USING btree ("user_id");