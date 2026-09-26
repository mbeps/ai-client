-- Embedding dimension configurable: pin to configured default (2048).
-- TRUNCATE required: existing vectors have wrong dimensionality for the new type.
TRUNCATE TABLE "kb_chunk";
ALTER TABLE "kb_chunk" ALTER COLUMN "embedding" TYPE vector(2048);
DROP INDEX IF EXISTS "kb_chunk_embedding_hnsw_idx";
UPDATE "knowledgebase" SET "index_status" = 'stale';
-- HNSW index only supports dimensions <= 2000. With the default 2048 it cannot be created.
-- If you configure EMBEDDING_DIMENSIONS <= 2000, enable ANN search manually with:
--   CREATE INDEX "kb_chunk_embedding_hnsw_idx" ON "kb_chunk" USING hnsw ("embedding" vector_cosine_ops);
