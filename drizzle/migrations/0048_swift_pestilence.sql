CREATE TABLE "subagent_scratchpad" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" text NOT NULL,
	"file_path" text NOT NULL,
	"content" text NOT NULL,
	"written_by_role" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subagent_scratchpad" ADD CONSTRAINT "subagent_scratchpad_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subagent_scratchpad" ADD CONSTRAINT "subagent_scratchpad_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subagent_scratchpad_msg_filepath_idx" ON "subagent_scratchpad" USING btree ("message_id","file_path");--> statement-breakpoint
CREATE INDEX "subagent_scratchpad_chat_msg_idx" ON "subagent_scratchpad" USING btree ("chat_id","message_id");