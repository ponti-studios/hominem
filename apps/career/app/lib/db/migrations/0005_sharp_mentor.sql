DROP INDEX "users_created_at_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "supabase_user_id" varchar(255);--> statement-breakpoint
CREATE INDEX "users_supabase_user_id_idx" ON "users" USING btree ("supabase_user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_supabase_user_id_unique" UNIQUE("supabase_user_id");