CREATE TABLE "career_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_experience_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"event_date" timestamp NOT NULL,
	"previous_title" varchar(255),
	"new_title" varchar(255),
	"previous_level" varchar(50),
	"new_level" varchar(50),
	"previous_salary" integer,
	"new_salary" integer,
	"salary_increase" integer,
	"increase_percentage" varchar(10),
	"previous_total_comp" integer,
	"new_total_comp" integer,
	"total_comp_increase" integer,
	"equity_granted" integer,
	"equity_vesting" varchar(100),
	"bonus_amount" integer,
	"bonus_type" varchar(50),
	"description" text,
	"achievements" json DEFAULT '[]'::json,
	"skills_gained" json DEFAULT '[]'::json,
	"certifications" json DEFAULT '[]'::json,
	"performance_rating" varchar(50),
	"manager_feedback" text,
	"self_assessment" text,
	"market_salary_range" json,
	"career_goals" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "career_events_type_check" CHECK ("career_events"."event_type" IN ('promotion', 'raise', 'bonus', 'equity_grant', 'role_change', 'department_change', 'location_change', 'performance_review', 'goal_achievement', 'certification', 'skill_milestone', 'manager_change', 'team_expansion')),
	CONSTRAINT "career_events_bonus_type_check" CHECK ("career_events"."bonus_type" IN ('annual', 'performance', 'retention', 'signing', 'spot', 'referral', 'project'))
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_expected" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_requested" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_offered" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_negotiated" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "salary_final" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "total_comp_offered" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "total_comp_final" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "equity_offered" varchar(100);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "equity_final" varchar(100);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "bonus_offered" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "bonus_final" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "source" varchar(100);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "application_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "response_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "first_interview_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "offer_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "decision_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "rejection_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "withdrawal_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "time_to_response" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "time_to_first_interview" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "time_to_offer" integer;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "time_to_decision" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "base_salary" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "currency" varchar(10) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "salary_range" json;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "total_compensation" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "equity_value" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "equity_percentage" varchar(20);--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "signing_bonus" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "annual_bonus" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "bonus_history" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "benefits" json;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "employment_type" varchar(50) DEFAULT 'full-time' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "work_arrangement" varchar(50) DEFAULT 'office' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "seniority_level" varchar(50);--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "department" varchar(100);--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "team_size" integer;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "reports_to" varchar(255);--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "direct_reports" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "performance_ratings" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "salary_adjustments" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "reason_for_leaving" varchar(100);--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "exit_notes" text;--> statement-breakpoint
ALTER TABLE "career_events" ADD CONSTRAINT "career_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_events" ADD CONSTRAINT "career_events_work_experience_id_work_experiences_id_fk" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_events_user_id_idx" ON "career_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "career_events_work_exp_id_idx" ON "career_events" USING btree ("work_experience_id");--> statement-breakpoint
CREATE INDEX "career_events_event_type_idx" ON "career_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "career_events_event_date_idx" ON "career_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "career_events_salary_increase_idx" ON "career_events" USING btree ("salary_increase");--> statement-breakpoint
CREATE INDEX "career_events_user_date_idx" ON "career_events" USING btree ("user_id","event_date");--> statement-breakpoint
CREATE INDEX "career_events_user_type_idx" ON "career_events" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "career_events_timeline_idx" ON "career_events" USING btree ("user_id","event_date","event_type");--> statement-breakpoint
CREATE INDEX "job_applications_application_date_idx" ON "job_applications" USING btree ("application_date");--> statement-breakpoint
CREATE INDEX "job_applications_salary_final_idx" ON "job_applications" USING btree ("salary_final");--> statement-breakpoint
CREATE INDEX "job_applications_source_idx" ON "job_applications" USING btree ("source");--> statement-breakpoint
CREATE INDEX "job_applications_offer_date_idx" ON "job_applications" USING btree ("offer_date");--> statement-breakpoint
CREATE INDEX "job_applications_user_app_date_idx" ON "job_applications" USING btree ("user_id","application_date");--> statement-breakpoint
CREATE INDEX "job_applications_user_salary_idx" ON "job_applications" USING btree ("user_id","salary_final");--> statement-breakpoint
CREATE INDEX "job_applications_status_salary_idx" ON "job_applications" USING btree ("status","salary_final");--> statement-breakpoint
CREATE INDEX "work_exp_start_date_idx" ON "work_experiences" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "work_exp_base_salary_idx" ON "work_experiences" USING btree ("base_salary");--> statement-breakpoint
CREATE INDEX "work_exp_employment_type_idx" ON "work_experiences" USING btree ("employment_type");--> statement-breakpoint
CREATE INDEX "work_exp_seniority_level_idx" ON "work_experiences" USING btree ("seniority_level");--> statement-breakpoint
CREATE INDEX "work_exp_portfolio_salary_idx" ON "work_experiences" USING btree ("portfolio_id","base_salary");--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_exp_employment_type_check" CHECK ("work_experiences"."employment_type" IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary'));--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_exp_work_arrangement_check" CHECK ("work_experiences"."work_arrangement" IN ('office', 'remote', 'hybrid', 'travel'));--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_exp_seniority_level_check" CHECK ("work_experiences"."seniority_level" IN ('intern', 'entry-level', 'mid-level', 'senior', 'lead', 'principal', 'staff', 'director', 'vp', 'c-level'));--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_exp_reason_leaving_check" CHECK ("work_experiences"."reason_for_leaving" IN ('promotion', 'better_opportunity', 'relocation', 'layoff', 'termination', 'contract_end', 'career_change', 'salary', 'culture', 'management', 'growth', 'personal'));