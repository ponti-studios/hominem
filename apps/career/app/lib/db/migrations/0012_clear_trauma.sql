ALTER TABLE "job_applications" ADD COLUMN "requirements" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "skills" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "job_posting_url" varchar(500);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "job_posting_word_count" integer;