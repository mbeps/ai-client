-- Add index_status column for state-based KB lifecycle tracking
-- Migration: replaces needs_reindex (text) + reindex_reason (text) with index_status (enum-like text)
ALTER TABLE "knowledgebase" ADD COLUMN "index_status" text DEFAULT 'ready' NOT NULL;
--> statement-breakpoint
-- Migrate existing data: if needs_reindex was 'true', set index_status to 'stale'
UPDATE "knowledgebase" SET "index_status" = 'stale' WHERE "needs_reindex" = 'true';
--> statement-breakpoint
-- Drop old columns
ALTER TABLE "knowledgebase" DROP COLUMN "needs_reindex";
--> statement-breakpoint
ALTER TABLE "knowledgebase" DROP COLUMN "reindex_reason";
