ALTER TABLE "skill" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "assistant_id" text;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_assistant_id_assistant_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_project_id_idx" ON "skill" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "skill_assistant_id_idx" ON "skill" USING btree ("assistant_id");