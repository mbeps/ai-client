ALTER TABLE "mcp_server" ALTER COLUMN "url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "mcp_server" DROP COLUMN "command";--> statement-breakpoint
ALTER TABLE "mcp_server" DROP COLUMN "args";--> statement-breakpoint
ALTER TABLE "mcp_server" DROP COLUMN "env";