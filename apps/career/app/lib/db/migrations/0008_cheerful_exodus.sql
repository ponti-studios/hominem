CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"website" varchar(500),
	"industry" varchar(100),
	"size" integer,
	"location" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"position" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" varchar(255),
	"job_posting" text,
	"salary_quoted" text,
	"salary_accepted" text,
	"cover_letter" text,
	"resume" text,
	"job_id" varchar(100),
	"link" varchar(500),
	"phone_screen" text,
	"reference" boolean DEFAULT false NOT NULL,
	"stages" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_applications_status_check" CHECK ("job_applications"."status" IN ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'))
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_industry_idx" ON "companies" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "companies_size_idx" ON "companies" USING btree ("size");--> statement-breakpoint
CREATE INDEX "job_applications_user_id_idx" ON "job_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_applications_company_id_idx" ON "job_applications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_applications_status_idx" ON "job_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_applications_start_date_idx" ON "job_applications" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "job_applications_user_status_idx" ON "job_applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "job_applications_user_date_idx" ON "job_applications" USING btree ("user_id","start_date");