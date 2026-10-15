ALTER TABLE "runs" ADD COLUMN "preset_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "effort" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "toolset" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "pending_input" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "usage" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "grounding" jsonb;