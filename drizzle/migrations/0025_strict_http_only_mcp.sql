-- Strict HTTP-only MCP migration.
-- This is intentionally non-destructive: legacy stdio rows are remediated and disabled,
-- while stdio-specific columns remain present for coordinated application cleanup.

-- 1) Deterministically remediate legacy non-HTTP rows.
UPDATE "mcp_server"
SET
	"enabled" = false,
	"is_public" = false,
	"type" = 'http',
	"url" = COALESCE(NULLIF(BTRIM("url"), ''), 'https://remediation.invalid/mcp/legacy-stdio/' || "id"),
	"headers" = COALESCE(
		NULLIF(BTRIM("headers"), ''),
		'{"x-mcp-remediation-status":"disabled","x-mcp-remediation-reason":"legacy-stdio"}'
	),
	"updated_at" = NOW()
WHERE "type" <> 'http';
--> statement-breakpoint

-- 2) Deterministically remediate malformed HTTP rows that have no usable URL.
UPDATE "mcp_server"
SET
	"enabled" = false,
	"is_public" = false,
	"url" = 'https://remediation.invalid/mcp/missing-url/' || "id",
	"headers" = COALESCE(
		NULLIF(BTRIM("headers"), ''),
		'{"x-mcp-remediation-status":"disabled","x-mcp-remediation-reason":"missing-url"}'
	),
	"updated_at" = NOW()
WHERE "type" = 'http'
	AND ("url" IS NULL OR BTRIM("url") = '');
--> statement-breakpoint

-- 3) Retire stdio-specific fields for active HTTP-only model.
UPDATE "mcp_server"
SET
	"command" = NULL,
	"args" = NULL,
	"env" = NULL,
	"updated_at" = NOW()
WHERE "command" IS NOT NULL OR "args" IS NOT NULL OR "env" IS NOT NULL;
--> statement-breakpoint

-- 4) Enforce strict HTTP-only invariants at DB level.
ALTER TABLE "mcp_server" DROP CONSTRAINT IF EXISTS "mcp_server_http_only_type_chk";
--> statement-breakpoint
ALTER TABLE "mcp_server" DROP CONSTRAINT IF EXISTS "mcp_server_http_url_required_chk";
--> statement-breakpoint

ALTER TABLE "mcp_server"
ADD CONSTRAINT "mcp_server_http_only_type_chk"
CHECK ("type" = 'http');
--> statement-breakpoint

ALTER TABLE "mcp_server"
ADD CONSTRAINT "mcp_server_http_url_required_chk"
CHECK ("url" IS NOT NULL AND BTRIM("url") <> '');
