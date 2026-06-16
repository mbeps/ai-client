-- Add search_vector tsvector generated column for full-text search on kb_chunk
-- This column was originally defined in migration 0015 but can be lost during
-- Drizzle push/sync operations since it's not tracked in the Drizzle ORM schema.
ALTER TABLE "kb_chunk" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;
--> statement-breakpoint
-- Recreate GIN index for fast full-text search queries
CREATE INDEX IF NOT EXISTS "kb_chunk_search_vector_idx" ON "kb_chunk" USING gin ("search_vector");
