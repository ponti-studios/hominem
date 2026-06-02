CREATE TABLE "application_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text,
	"file_content" text,
	"mime_type" varchar(100),
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "application_files_type_check" CHECK ("application_files"."type" IN ('resume', 'cover_letter', 'portfolio', 'offer_letter', 'other'))
);
--> statement-breakpoint
CREATE TABLE "application_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255),
	"content" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "application_notes_type_check" CHECK ("application_notes"."type" IN ('general', 'interview', 'feedback', 'research', 'follow_up'))
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "interview_dates" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "company_notes" text;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "negotiation_notes" text;--> statement-breakpoint
ALTER TABLE "application_files" ADD CONSTRAINT "application_files_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_files_app_id_idx" ON "application_files" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_files_type_idx" ON "application_files" USING btree ("type");--> statement-breakpoint
CREATE INDEX "application_files_created_at_idx" ON "application_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "application_notes_app_id_idx" ON "application_notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_notes_type_idx" ON "application_notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "application_notes_created_at_idx" ON "application_notes" USING btree ("created_at");