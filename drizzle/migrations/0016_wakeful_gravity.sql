-- Drop the HNSW index before altering the column type
DROP INDEX IF EXISTS "kb_chunk_embedding_hnsw_idx";

-- Clear stale embeddings (incompatible with new 2048-dim model)
TRUNCATE TABLE "kb_chunk";

-- Change embedding column from vector(1536) to vector(2048) for nvidia/llama-nemotron-embed-vl-1b-v2
-- Note: pgvector HNSW/IVFFlat indexes are limited to 2000 dims; exact cosine search is used instead
ALTER TABLE "kb_chunk" ALTER COLUMN "embedding" SET DATA TYPE vector(2048);

-- Restore search_vector generated column (may have been lost during the ALTER)
ALTER TABLE "kb_chunk" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

-- Recreate GIN index for full-text search
CREATE INDEX IF NOT EXISTS "kb_chunk_search_vector_idx" ON "kb_chunk" USING gin ("search_vector");