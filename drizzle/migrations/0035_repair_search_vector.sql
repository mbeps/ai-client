-- Repair search_vector: restore GENERATED ALWAYS column (0032 recreated it as plain tsvector)
ALTER TABLE "kb_chunk" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "kb_chunk" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;
CREATE INDEX IF NOT EXISTS "kb_chunk_search_vector_idx" ON "kb_chunk" USING gin ("search_vector");
