DROP INDEX "analytics_created_at_idx";--> statement-breakpoint
DROP INDEX "work_exp_type_idx";--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
CREATE INDEX "analytics_portfolio_event_date_idx" ON "analytics" USING btree ("portfolio_id","event","created_at");--> statement-breakpoint
CREATE INDEX "analytics_portfolio_date_idx" ON "analytics" USING btree ("portfolio_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_active_idx" ON "portfolios" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "portfolio_public_active_idx" ON "portfolios" USING btree ("is_public","is_active");--> statement-breakpoint
CREATE INDEX "portfolio_user_active_idx" ON "portfolios" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "projects_portfolio_featured_visible_idx" ON "projects" USING btree ("portfolio_id","is_featured","is_visible");--> statement-breakpoint
CREATE INDEX "projects_portfolio_visible_idx" ON "projects" USING btree ("portfolio_id","is_visible");--> statement-breakpoint
CREATE INDEX "skills_visible_idx" ON "skills" USING btree ("is_visible");--> statement-breakpoint
CREATE INDEX "skills_level_idx" ON "skills" USING btree ("level");--> statement-breakpoint
CREATE INDEX "skills_portfolio_visible_idx" ON "skills" USING btree ("portfolio_id","is_visible");--> statement-breakpoint
CREATE INDEX "skills_portfolio_category_idx" ON "skills" USING btree ("portfolio_id","category");--> statement-breakpoint
CREATE INDEX "skills_portfolio_sort_idx" ON "skills" USING btree ("portfolio_id","sort_order");--> statement-breakpoint
CREATE INDEX "testimonials_portfolio_verified_idx" ON "testimonials" USING btree ("portfolio_id","is_verified","is_visible");--> statement-breakpoint
CREATE INDEX "testimonials_portfolio_visible_idx" ON "testimonials" USING btree ("portfolio_id","is_visible");--> statement-breakpoint
CREATE INDEX "work_exp_visible_idx" ON "work_experiences" USING btree ("is_visible");--> statement-breakpoint
CREATE INDEX "work_exp_created_at_idx" ON "work_experiences" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "work_exp_portfolio_visible_idx" ON "work_experiences" USING btree ("portfolio_id","is_visible");--> statement-breakpoint
CREATE INDEX "work_exp_portfolio_sort_idx" ON "work_experiences" USING btree ("portfolio_id","sort_order");--> statement-breakpoint
ALTER TABLE "work_experiences" DROP COLUMN "year";--> statement-breakpoint
ALTER TABLE "work_experiences" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_level_check" CHECK ("skills"."level" >= 1 AND "skills"."level" <= 100);--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_rating_check" CHECK ("testimonials"."rating" >= 1 AND "testimonials"."rating" <= 5);