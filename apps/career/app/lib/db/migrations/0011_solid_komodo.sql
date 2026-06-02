CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"issuing_organization" varchar(255) NOT NULL,
	"issue_date" timestamp NOT NULL,
	"expiration_date" timestamp,
	"next_renewal_date" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"work_experience_id" uuid,
	"category" varchar(100),
	"cost" integer,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certifications_status_check" CHECK ("certifications"."status" IN ('active', 'expired', 'pending_renewal', 'archived')),
	CONSTRAINT "certifications_category_check" CHECK ("certifications"."category" IN ('technical', 'leadership', 'compliance', 'industry', 'language', 'project_management', 'security', 'cloud', 'data', 'design'))
);
--> statement-breakpoint
ALTER TABLE "career_events" DROP CONSTRAINT "career_events_type_check";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "work_experience_id" uuid;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_work_experience_id_work_experiences_id_fk" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_user_id_idx" ON "certifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certifications_status_idx" ON "certifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "certifications_category_idx" ON "certifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "certifications_issue_date_idx" ON "certifications" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "certifications_expiration_date_idx" ON "certifications" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "certifications_work_exp_idx" ON "certifications" USING btree ("work_experience_id");--> statement-breakpoint
CREATE INDEX "certifications_user_status_idx" ON "certifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "certifications_user_visible_idx" ON "certifications" USING btree ("user_id","is_visible");--> statement-breakpoint
CREATE INDEX "certifications_user_sort_idx" ON "certifications" USING btree ("user_id","sort_order","is_visible");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_work_experience_id_work_experiences_id_fk" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_work_exp_idx" ON "projects" USING btree ("work_experience_id");--> statement-breakpoint
CREATE INDEX "projects_work_exp_visible_idx" ON "projects" USING btree ("work_experience_id","is_visible");--> statement-breakpoint
ALTER TABLE "career_events" DROP COLUMN "certifications";--> statement-breakpoint
ALTER TABLE "skills" DROP COLUMN "certifications";--> statement-breakpoint
ALTER TABLE "career_events" ADD CONSTRAINT "career_events_type_check" CHECK ("career_events"."event_type" IN ('promotion', 'raise', 'bonus', 'equity_grant', 'role_change', 'department_change', 'location_change', 'performance_review', 'goal_achievement', 'skill_milestone', 'manager_change', 'team_expansion'));