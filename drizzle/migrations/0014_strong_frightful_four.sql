CREATE TABLE "knowledgebase" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "knowledgebases" text[];--> statement-breakpoint
ALTER TABLE "knowledgebase" ADD CONSTRAINT "knowledgebase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledgebase_user_id_idx" ON "knowledgebase" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "transform_run" DROP COLUMN "step_results";