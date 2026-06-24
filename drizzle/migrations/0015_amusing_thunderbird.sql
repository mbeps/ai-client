-- Enable pgvector extension (required for vector column and HNSW index)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "kb_document" (
	"id" text PRIMARY KEY NOT NULL,
	"kb_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"s3_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"kb_id" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
	"chunk_index" integer NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"chunk_metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "knowledgebase_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "knowledgebase_id" text;--> statement-breakpoint
ALTER TABLE "kb_document" ADD CONSTRAINT "kb_document_kb_id_knowledgebase_id_fk" FOREIGN KEY ("kb_id") REFERENCES "public"."knowledgebase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_document" ADD CONSTRAINT "kb_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunk" ADD CONSTRAINT "kb_chunk_document_id_kb_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_document_kb_id_idx" ON "kb_document" USING btree ("kb_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_document_s3_key_idx" ON "kb_document" USING btree ("s3_key");--> statement-breakpoint
CREATE INDEX "kb_chunk_kb_id_idx" ON "kb_chunk" USING btree ("kb_id");--> statement-breakpoint
CREATE INDEX "kb_chunk_document_id_idx" ON "kb_chunk" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "kb_chunk_search_vector_idx" ON "kb_chunk" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "kb_chunk_embedding_hnsw_idx" ON "kb_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "knowledgebases";