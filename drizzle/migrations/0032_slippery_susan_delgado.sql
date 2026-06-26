ALTER TABLE "kb_chunk" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "kb_chunk_search_vector_idx" ON "kb_chunk" USING gin ("search_vector");