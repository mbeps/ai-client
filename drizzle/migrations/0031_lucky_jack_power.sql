DROP INDEX "attachment_key_idx";--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "extracted_text" text;--> statement-breakpoint
CREATE INDEX "attachment_key_idx" ON "attachment" USING btree ("key");