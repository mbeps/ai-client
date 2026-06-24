ALTER TABLE "transform_run" ALTER COLUMN "input_attachment_ids" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "transform_run" ALTER COLUMN "input_attachment_ids" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "transform_run" ALTER COLUMN "output_attachment_ids" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "transform_run" ALTER COLUMN "output_attachment_ids" SET DEFAULT '{}'::text[];