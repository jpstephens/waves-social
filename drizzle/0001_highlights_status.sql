CREATE TYPE "public"."highlight_status" AS ENUM('proposed', 'selected', 'rejected');--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "status" "highlight_status" DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "player_name_raw" text;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "jersey_number" integer;