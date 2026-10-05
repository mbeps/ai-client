ALTER TABLE "message" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "message" SET "updated_at" = "created_at";