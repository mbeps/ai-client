ALTER TABLE "knowledgebase" ADD COLUMN "needs_reindex" text DEFAULT 'false' NOT NULL;
--> statement-breakpoint
ALTER TABLE "knowledgebase" ADD COLUMN "last_indexed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "knowledgebase" ADD COLUMN "reindex_reason" text;