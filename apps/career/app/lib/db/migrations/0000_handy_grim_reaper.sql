CREATE TABLE "analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"path" varchar(500),
	"visitor_id" varchar(100),
	"ip_address" varchar(50),
	"user_agent" text,
	"referer" varchar(500),
	"country" varchar(100),
	"city" varchar(100),
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"personal_info" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"short_description" varchar(500),
	"live_url" varchar(500),
	"github_url" varchar(500),
	"image_url" varchar(500),
	"video_url" varchar(500),
	"technologies" json DEFAULT '[]'::json,
	"status" varchar(50) DEFAULT 'completed',
	"start_date" timestamp,
	"end_date" timestamp,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"level" integer NOT NULL,
	"category" varchar(100),
	"icon" varchar(100),
	"description" text,
	"years_of_experience" integer,
	"certifications" json DEFAULT '[]'::json,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255),
	"company" varchar(255),
	"content" text NOT NULL,
	"avatar_url" varchar(500),
	"linkedin_url" varchar(500),
	"rating" integer,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"subtitle" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"role" varchar(255) NOT NULL,
	"year" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"image" varchar(500),
	"gradient" varchar(100),
	"metrics" varchar(100),
	"action" varchar(100),
	"tags" json DEFAULT '[]'::json,
	"metadata" json,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_portfolio_id_idx" ON "analytics" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "analytics_event_idx" ON "analytics" USING btree ("event");--> statement-breakpoint
CREATE INDEX "analytics_created_at_idx" ON "analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_visitor_id_idx" ON "analytics" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "portfolio_user_id_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolio_slug_idx" ON "portfolios" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "portfolio_public_idx" ON "portfolios" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "projects_portfolio_id_idx" ON "projects" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_featured_idx" ON "projects" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "projects_sort_order_idx" ON "projects" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "skills_portfolio_id_idx" ON "skills" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "skills_sort_order_idx" ON "skills" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "testimonials_portfolio_id_idx" ON "testimonials" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "testimonials_rating_idx" ON "testimonials" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "testimonials_sort_order_idx" ON "testimonials" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "work_exp_portfolio_id_idx" ON "work_experiences" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "work_exp_type_idx" ON "work_experiences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "work_exp_sort_order_idx" ON "work_experiences" USING btree ("sort_order");