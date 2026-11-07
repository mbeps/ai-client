CREATE TABLE "mcp_oauth_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" text,
	"scope" text,
	"access_token_expires_at" timestamp,
	"client_information" text,
	"authorization_server_info" text,
	"code_verifier" text,
	"oauth_state" text,
	"state_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant" ADD COLUMN "prompt_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant" ADD COLUMN "prompt_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "auth_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "oauth_client_id" text;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "oauth_client_secret" text;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "oauth_scope" text;--> statement-breakpoint
ALTER TABLE "user_mcp_server_install" ADD COLUMN "oauth_client_id" text;--> statement-breakpoint
ALTER TABLE "user_mcp_server_install" ADD COLUMN "oauth_client_secret" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "prompt_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "prompt_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "prompt" ADD COLUMN "assistant_id" text;--> statement-breakpoint
ALTER TABLE "mcp_oauth_credential" ADD CONSTRAINT "mcp_oauth_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_credential" ADD CONSTRAINT "mcp_oauth_credential_server_id_mcp_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_credential_user_server_idx" ON "mcp_oauth_credential" USING btree ("user_id","server_id");--> statement-breakpoint
CREATE INDEX "mcp_oauth_credential_state_idx" ON "mcp_oauth_credential" USING btree ("oauth_state");--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_assistant_id_assistant_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_project_id_idx" ON "prompt" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "prompt_assistant_id_idx" ON "prompt" USING btree ("assistant_id");