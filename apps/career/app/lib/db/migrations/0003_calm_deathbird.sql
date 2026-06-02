CREATE TABLE "portfolio_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"github" varchar(500),
	"linkedin" varchar(500),
	"twitter" varchar(500),
	"website" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_links_portfolio_id_unique" UNIQUE("portfolio_id")
);
--> statement-breakpoint
DROP INDEX "email_idx";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "initials" varchar(10);--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "job_title" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "bio" text NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "tagline" varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "current_location" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "location_tagline" varchar(255);--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "availability_status" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "availability_message" varchar(500);--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "theme" json;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "copyright" varchar(255);--> statement-breakpoint
ALTER TABLE "portfolio_stats" ADD CONSTRAINT "portfolio_stats_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_stats_portfolio_id_idx" ON "portfolio_stats" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolio_stats_sort_order_idx" ON "portfolio_stats" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "portfolio_stats_portfolio_sort_idx" ON "portfolio_stats" USING btree ("portfolio_id","sort_order");--> statement-breakpoint
CREATE INDEX "social_links_portfolio_id_idx" ON "social_links" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolio_email_idx" ON "portfolios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "portfolios" DROP COLUMN "personal_info";--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_event_check" CHECK ("analytics"."event" IN ('view', 'contact_click', 'project_click', 'skill_click', 'social_click', 'download_resume', 'copy_email'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check" CHECK ("projects"."status" IN ('in-progress', 'completed', 'archived'));--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_check" CHECK ("skills"."category" IN ('technical', 'leadership', 'design', 'languages', 'frameworks', 'tools', 'soft_skills', 'certifications'));