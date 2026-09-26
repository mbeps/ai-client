CREATE TABLE IF NOT EXISTS "user_mcp_server_install" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"headers" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_mcp_server_install" ADD CONSTRAINT "user_mcp_server_install_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_mcp_server_install" ADD CONSTRAINT "user_mcp_server_install_server_id_mcp_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_mcp_server_install_user_id_idx" ON "user_mcp_server_install" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_mcp_server_install_server_id_idx" ON "user_mcp_server_install" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_mcp_server_install_user_server_idx" ON "user_mcp_server_install" USING btree ("user_id","server_id");