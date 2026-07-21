-- Career dev seed — one-shot bootstrap of all career tables + sample data.
--
-- Merges the three 20260602124500-24700 migration files plus all subsequent
-- career schema changes (drops, additions, renames) and the existing
-- seed-projects-and-testimonials.sql into a single idempotent seed for dev.
--
-- Safe to re-run: DDL uses IF NOT EXISTS, inserts are guarded by existence
-- checks.  Does NOT create the public "user" table (owned by Better Auth) or
-- the `auth` schema helper functions — those come from the core migrations.
-- Run those first if bootstrapping a fresh database.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1.  Schema & helpers (idempotent)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updatedAt := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_userId', true), '')
$$;

CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_service_role', true), ''), 'false') = 'true'
$$;

CREATE OR REPLACE FUNCTION auth.is_portfolio_owner(target_portfolio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.portfolios portfolio
    WHERE portfolio.id = target_portfolio_id
      AND (
        auth.is_service_role()
        OR portfolio.owner_userId = auth.current_user_id()
      )
  )
$$;

CREATE OR REPLACE FUNCTION auth.can_read_portfolio(target_portfolio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.portfolios portfolio
    WHERE portfolio.id = target_portfolio_id
      AND (
        auth.is_portfolio_owner(target_portfolio_id)
        OR (portfolio.is_public = true AND portfolio.is_active = true)
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 2.  Tables  (CREATE TABLE IF NOT EXISTS — current state after all
--     migrations, including drops of theme / location_tagline /
--     availability_message / total_compensation / equity_value /
--     equity_percentage and addition of open_to_remote / ai_derived / proof.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  name text NOT NULL,
  initials text,
  job_title text NOT NULL,
  bio text NOT NULL,
  tagline text NOT NULL,
  current_location text NOT NULL,
  open_to_remote boolean NOT NULL DEFAULT false,
  availability_status boolean NOT NULL DEFAULT false,
  email text NOT NULL,
  phone text,
  copyright text,
  profile_image_url text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  role text NOT NULL,
  company text NOT NULL,
  description text NOT NULL,
  start_date timestamptz,
  end_date timestamptz,
  base_salary integer,
  currency text NOT NULL DEFAULT 'USD',
  salary_range jsonb,
  signing_bonus integer,
  annual_bonus integer,
  bonus_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  benefits jsonb,
  employment_type text NOT NULL DEFAULT 'full-time',
  work_arrangement text NOT NULL DEFAULT 'office',
  seniority_level text,
  department text,
  team_size integer,
  reports_to text,
  direct_reports integer NOT NULL DEFAULT 0,
  performance_ratings jsonb NOT NULL DEFAULT '[]'::jsonb,
  salary_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  image text,
  gradient text,
  metrics text,
  action text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  reason_for_leaving text,
  exit_notes text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  short_description text,
  live_url text,
  github_url text,
  image_url text,
  video_url text,
  technologies jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  start_date timestamptz,
  end_date timestamptz,
  work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE SET NULL,
  is_featured boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer NOT NULL,
  category text,
  icon text,
  description text,
  years_of_experience integer,
  ai_derived boolean NOT NULL DEFAULT false,
  proof text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  company text,
  content text NOT NULL,
  avatar_url text,
  linkedin_url text,
  rating integer,
  is_verified boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.portfolio_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  event text NOT NULL,
  path text,
  visitor_id text,
  ip_address text,
  user_agent text,
  referer text,
  country text,
  city text,
  metadata jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  issuing_organization text NOT NULL,
  issue_date timestamptz NOT NULL,
  expiration_date timestamptz,
  next_renewal_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE SET NULL,
  category text,
  cost integer,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  size integer,
  location text,
  description text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  position text NOT NULL,
  status text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  location text,
  job_posting text,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  job_posting_url text,
  job_posting_word_count integer,
  salary_quoted text,
  salary_accepted text,
  salary_expected integer,
  salary_requested integer,
  salary_offered integer,
  salary_negotiated integer,
  salary_final integer,
  total_comp_offered integer,
  total_comp_final integer,
  equity_offered text,
  equity_final text,
  bonus_offered integer,
  bonus_final integer,
  source text,
  application_date timestamptz,
  response_date timestamptz,
  first_interview_date timestamptz,
  offer_date timestamptz,
  decision_date timestamptz,
  rejection_reason text,
  withdrawal_reason text,
  time_to_response integer,
  time_to_first_interview integer,
  time_to_offer integer,
  time_to_decision integer,
  cover_letter text,
  resume text,
  job_id text,
  link text,
  phone_screen text,
  reference boolean NOT NULL DEFAULT false,
  interview_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  company_notes text,
  negotiation_notes text,
  recruiter_name text,
  recruiter_email text,
  recruiter_linkedin text,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  content text NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.application_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_content text,
  mime_type text,
  file_size integer,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.career_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date timestamptz NOT NULL,
  previous_title text,
  new_title text,
  previous_level text,
  new_level text,
  previous_salary integer,
  new_salary integer,
  salary_increase integer,
  increase_percentage text,
  previous_total_comp integer,
  new_total_comp integer,
  total_comp_increase integer,
  equity_granted integer,
  equity_vesting text,
  bonus_amount integer,
  bonus_type text,
  description text,
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills_gained jsonb NOT NULL DEFAULT '[]'::jsonb,
  performance_rating text,
  manager_feedback text,
  self_assessment text,
  market_salary_range jsonb,
  career_goals jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.user_social_links (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  github text,
  linkedin text,
  twitter text,
  website text,
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.job_application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  createdAt timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3.  Constraints, indexes, triggers
-- ---------------------------------------------------------------------------

-- 3a.  CHECK constraints  (excludes portfolio_stats and social_links tables)
--      (use DO blocks so they are idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_owner_userId_key') THEN
    ALTER TABLE app.portfolios
      ADD CONSTRAINT app_portfolios_owner_userId_key UNIQUE (owner_userId);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_slug_check') THEN
    ALTER TABLE app.portfolios
      ADD CONSTRAINT app_portfolios_slug_check CHECK (
        length(btrim(slug)) BETWEEN 3 AND 50 AND slug ~ '^[a-z0-9-]+$'
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_title_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_title_not_blank CHECK (length(btrim(title)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_name_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_job_title_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_job_title_not_blank CHECK (length(btrim(job_title)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_bio_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_bio_not_blank CHECK (length(btrim(bio)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_tagline_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_tagline_not_blank CHECK (length(btrim(tagline)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_current_location_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_current_location_not_blank CHECK (length(btrim(current_location)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolios_email_not_blank') THEN
    ALTER TABLE app.portfolios ADD CONSTRAINT app_portfolios_email_not_blank CHECK (length(btrim(email)) > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_role_not_blank') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_role_not_blank CHECK (length(btrim(role)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_company_not_blank') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_company_not_blank CHECK (length(btrim(company)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_description_not_blank') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_description_not_blank CHECK (length(btrim(description)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_date_order_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_date_order_check CHECK (
      end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_base_salary_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_base_salary_check CHECK (base_salary IS NULL OR base_salary >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_signing_bonus_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_signing_bonus_check CHECK (signing_bonus IS NULL OR signing_bonus >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_annual_bonus_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_annual_bonus_check CHECK (annual_bonus IS NULL OR annual_bonus >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_team_size_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_team_size_check CHECK (team_size IS NULL OR team_size >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_direct_reports_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_direct_reports_check CHECK (direct_reports >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_sort_order_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_sort_order_check CHECK (sort_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_employment_type_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_employment_type_check CHECK (
      employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_work_arrangement_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_work_arrangement_check CHECK (
      work_arrangement IN ('office', 'remote', 'hybrid', 'travel')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_seniority_level_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_seniority_level_check CHECK (
      seniority_level IS NULL OR seniority_level IN (
        'intern', 'entry-level', 'mid-level', 'senior', 'lead', 'principal',
        'staff', 'director', 'vp', 'c-level'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_work_experiences_reason_for_leaving_check') THEN
    ALTER TABLE app.work_experiences ADD CONSTRAINT app_work_experiences_reason_for_leaving_check CHECK (
      reason_for_leaving IS NULL OR reason_for_leaving IN (
        'promotion', 'better_opportunity', 'relocation', 'layoff', 'termination',
        'contract_end', 'career_change', 'salary', 'culture', 'management',
        'growth', 'personal'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_projects_title_not_blank') THEN
    ALTER TABLE app.projects ADD CONSTRAINT app_projects_title_not_blank CHECK (length(btrim(title)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_projects_description_not_blank') THEN
    ALTER TABLE app.projects ADD CONSTRAINT app_projects_description_not_blank CHECK (length(btrim(description)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_projects_date_order_check') THEN
    ALTER TABLE app.projects ADD CONSTRAINT app_projects_date_order_check CHECK (
      end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_projects_sort_order_check') THEN
    ALTER TABLE app.projects ADD CONSTRAINT app_projects_sort_order_check CHECK (sort_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_projects_status_check') THEN
    ALTER TABLE app.projects ADD CONSTRAINT app_projects_status_check CHECK (status IN ('in-progress', 'completed', 'archived'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_skills_name_not_blank') THEN
    ALTER TABLE app.skills ADD CONSTRAINT app_skills_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_skills_level_check') THEN
    ALTER TABLE app.skills ADD CONSTRAINT app_skills_level_check CHECK (level BETWEEN 1 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_skills_years_of_experience_check') THEN
    ALTER TABLE app.skills ADD CONSTRAINT app_skills_years_of_experience_check CHECK (years_of_experience IS NULL OR years_of_experience >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_skills_sort_order_check') THEN
    ALTER TABLE app.skills ADD CONSTRAINT app_skills_sort_order_check CHECK (sort_order >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_testimonials_name_not_blank') THEN
    ALTER TABLE app.testimonials ADD CONSTRAINT app_testimonials_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_testimonials_content_not_blank') THEN
    ALTER TABLE app.testimonials ADD CONSTRAINT app_testimonials_content_not_blank CHECK (length(btrim(content)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_testimonials_rating_check') THEN
    ALTER TABLE app.testimonials ADD CONSTRAINT app_testimonials_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_testimonials_sort_order_check') THEN
    ALTER TABLE app.testimonials ADD CONSTRAINT app_testimonials_sort_order_check CHECK (sort_order >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_portfolio_analytics_event_check') THEN
    ALTER TABLE app.portfolio_analytics ADD CONSTRAINT app_portfolio_analytics_event_check CHECK (
      event IN ('view', 'contact_click', 'project_click', 'skill_click', 'social_click', 'download_resume', 'copy_email')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_name_not_blank') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_issuing_organization_not_blank') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_issuing_organization_not_blank CHECK (length(btrim(issuing_organization)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_date_order_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_date_order_check CHECK (
      expiration_date IS NULL OR expiration_date >= issue_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_next_renewal_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_next_renewal_check CHECK (
      next_renewal_date IS NULL OR next_renewal_date >= issue_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_cost_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_cost_check CHECK (cost IS NULL OR cost >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_sort_order_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_sort_order_check CHECK (sort_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_status_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_status_check CHECK (
      status IN ('active', 'expired', 'pending_renewal', 'archived')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_certifications_category_check') THEN
    ALTER TABLE app.certifications ADD CONSTRAINT app_certifications_category_check CHECK (
      category IS NULL OR category IN (
        'technical', 'leadership', 'compliance', 'industry', 'language',
        'project_management', 'security', 'cloud', 'data', 'design'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_companies_name_not_blank') THEN
    ALTER TABLE app.companies ADD CONSTRAINT app_companies_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_companies_size_check') THEN
    ALTER TABLE app.companies ADD CONSTRAINT app_companies_size_check CHECK (size IS NULL OR size >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_position_not_blank') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_position_not_blank CHECK (length(btrim(position)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_date_order_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_date_order_check CHECK (
      end_date IS NULL OR end_date >= start_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_job_posting_word_count_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_job_posting_word_count_check CHECK (job_posting_word_count IS NULL OR job_posting_word_count >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_time_to_response_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_time_to_response_check CHECK (time_to_response IS NULL OR time_to_response >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_time_to_first_interview_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_time_to_first_interview_check CHECK (time_to_first_interview IS NULL OR time_to_first_interview >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_time_to_offer_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_time_to_offer_check CHECK (time_to_offer IS NULL OR time_to_offer >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_time_to_decision_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_time_to_decision_check CHECK (time_to_decision IS NULL OR time_to_decision >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_salary_expected_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_salary_expected_check CHECK (salary_expected IS NULL OR salary_expected >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_salary_requested_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_salary_requested_check CHECK (salary_requested IS NULL OR salary_requested >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_salary_offered_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_salary_offered_check CHECK (salary_offered IS NULL OR salary_offered >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_salary_negotiated_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_salary_negotiated_check CHECK (salary_negotiated IS NULL OR salary_negotiated >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_salary_final_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_salary_final_check CHECK (salary_final IS NULL OR salary_final >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_total_comp_offered_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_total_comp_offered_check CHECK (total_comp_offered IS NULL OR total_comp_offered >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_total_comp_final_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_total_comp_final_check CHECK (total_comp_final IS NULL OR total_comp_final >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_bonus_offered_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_bonus_offered_check CHECK (bonus_offered IS NULL OR bonus_offered >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_bonus_final_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_bonus_final_check CHECK (bonus_final IS NULL OR bonus_final >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_applications_status_check') THEN
    ALTER TABLE app.job_applications ADD CONSTRAINT app_job_applications_status_check CHECK (
      status IN ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_application_notes_content_not_blank') THEN
    ALTER TABLE app.application_notes ADD CONSTRAINT app_application_notes_content_not_blank CHECK (length(btrim(content)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_application_notes_type_check') THEN
    ALTER TABLE app.application_notes ADD CONSTRAINT app_application_notes_type_check CHECK (
      type IN ('general', 'interview', 'feedback', 'research', 'follow_up')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_application_files_file_name_not_blank') THEN
    ALTER TABLE app.application_files ADD CONSTRAINT app_application_files_file_name_not_blank CHECK (length(btrim(file_name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_application_files_file_size_check') THEN
    ALTER TABLE app.application_files ADD CONSTRAINT app_application_files_file_size_check CHECK (file_size IS NULL OR file_size >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_application_files_type_check') THEN
    ALTER TABLE app.application_files ADD CONSTRAINT app_application_files_type_check CHECK (
      type IN ('resume', 'cover_letter', 'portfolio', 'offer_letter', 'other')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_career_events_date_not_future_check') THEN
    ALTER TABLE app.career_events ADD CONSTRAINT app_career_events_date_not_future_check CHECK (event_date IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_career_events_equity_granted_check') THEN
    ALTER TABLE app.career_events ADD CONSTRAINT app_career_events_equity_granted_check CHECK (equity_granted IS NULL OR equity_granted >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_career_events_bonus_amount_check') THEN
    ALTER TABLE app.career_events ADD CONSTRAINT app_career_events_bonus_amount_check CHECK (bonus_amount IS NULL OR bonus_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_career_events_event_type_check') THEN
    ALTER TABLE app.career_events ADD CONSTRAINT app_career_events_event_type_check CHECK (
      event_type IN (
        'promotion', 'raise', 'bonus', 'equity_grant', 'role_change',
        'department_change', 'location_change', 'performance_review',
        'goal_achievement', 'skill_milestone', 'manager_change', 'team_expansion'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_career_events_bonus_type_check') THEN
    ALTER TABLE app.career_events ADD CONSTRAINT app_career_events_bonus_type_check CHECK (
      bonus_type IS NULL OR bonus_type IN ('annual', 'performance', 'retention', 'signing', 'spot', 'referral', 'project')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_application_status_history_new_status_check') THEN
    ALTER TABLE app.job_application_status_history
      ADD CONSTRAINT app_job_application_status_history_new_status_check CHECK (
        new_status IN ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_job_application_status_history_previous_status_check') THEN
    ALTER TABLE app.job_application_status_history
      ADD CONSTRAINT app_job_application_status_history_previous_status_check CHECK (
        previous_status IS NULL OR previous_status IN ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
      );
  END IF;
END $$;

-- 3b.  Indexes  (excludes portfolio_stats and social_links indexes)
CREATE INDEX IF NOT EXISTS app_portfolios_slug_key ON app.portfolios (lower(slug));
CREATE INDEX IF NOT EXISTS app_portfolios_owner_userId_idx ON app.portfolios (owner_userId);
CREATE INDEX IF NOT EXISTS app_portfolios_public_active_idx ON app.portfolios (is_public, is_active);
CREATE INDEX IF NOT EXISTS app_portfolios_email_idx ON app.portfolios (lower(email));

CREATE INDEX IF NOT EXISTS app_work_experiences_portfolio_id_idx ON app.work_experiences (portfolio_id);
CREATE INDEX IF NOT EXISTS app_work_experiences_sort_order_idx ON app.work_experiences (sort_order);
CREATE INDEX IF NOT EXISTS app_work_experiences_visible_idx ON app.work_experiences (is_visible);
CREATE INDEX IF NOT EXISTS app_work_experiences_start_date_idx ON app.work_experiences (start_date);
CREATE INDEX IF NOT EXISTS app_work_experiences_base_salary_idx ON app.work_experiences (base_salary);
CREATE INDEX IF NOT EXISTS app_work_experiences_employment_type_idx ON app.work_experiences (employment_type);
CREATE INDEX IF NOT EXISTS app_work_experiences_seniority_level_idx ON app.work_experiences (seniority_level);
CREATE INDEX IF NOT EXISTS app_work_experiences_portfolio_visible_idx ON app.work_experiences (portfolio_id, is_visible);
CREATE INDEX IF NOT EXISTS app_work_experiences_portfolio_sort_idx ON app.work_experiences (portfolio_id, sort_order);
CREATE INDEX IF NOT EXISTS app_work_experiences_portfolio_salary_idx ON app.work_experiences (portfolio_id, base_salary);

CREATE INDEX IF NOT EXISTS app_projects_portfolio_id_idx ON app.projects (portfolio_id);
CREATE INDEX IF NOT EXISTS app_projects_status_idx ON app.projects (status);
CREATE INDEX IF NOT EXISTS app_projects_featured_idx ON app.projects (is_featured);
CREATE INDEX IF NOT EXISTS app_projects_sort_order_idx ON app.projects (sort_order);
CREATE INDEX IF NOT EXISTS app_projects_work_experience_id_idx ON app.projects (work_experience_id);
CREATE INDEX IF NOT EXISTS app_projects_portfolio_featured_visible_idx ON app.projects (portfolio_id, is_featured, is_visible);
CREATE INDEX IF NOT EXISTS app_projects_portfolio_visible_idx ON app.projects (portfolio_id, is_visible);
CREATE INDEX IF NOT EXISTS app_projects_work_experience_visible_idx ON app.projects (work_experience_id, is_visible);

CREATE INDEX IF NOT EXISTS app_skills_portfolio_id_idx ON app.skills (portfolio_id);
CREATE INDEX IF NOT EXISTS app_skills_category_idx ON app.skills (category);
CREATE INDEX IF NOT EXISTS app_skills_sort_order_idx ON app.skills (sort_order);
CREATE INDEX IF NOT EXISTS app_skills_visible_idx ON app.skills (is_visible);
CREATE INDEX IF NOT EXISTS app_skills_level_idx ON app.skills (level);
CREATE INDEX IF NOT EXISTS app_skills_portfolio_visible_idx ON app.skills (portfolio_id, is_visible);
CREATE INDEX IF NOT EXISTS app_skills_portfolio_category_idx ON app.skills (portfolio_id, category);
CREATE INDEX IF NOT EXISTS app_skills_portfolio_sort_idx ON app.skills (portfolio_id, sort_order);

CREATE INDEX IF NOT EXISTS app_testimonials_portfolio_id_idx ON app.testimonials (portfolio_id);
CREATE INDEX IF NOT EXISTS app_testimonials_rating_idx ON app.testimonials (rating);
CREATE INDEX IF NOT EXISTS app_testimonials_sort_order_idx ON app.testimonials (sort_order);
CREATE INDEX IF NOT EXISTS app_testimonials_portfolio_verified_idx ON app.testimonials (portfolio_id, is_verified, is_visible);
CREATE INDEX IF NOT EXISTS app_testimonials_portfolio_visible_idx ON app.testimonials (portfolio_id, is_visible);

CREATE INDEX IF NOT EXISTS app_portfolio_analytics_portfolio_id_idx ON app.portfolio_analytics (portfolio_id);
CREATE INDEX IF NOT EXISTS app_portfolio_analytics_event_idx ON app.portfolio_analytics (event);
CREATE INDEX IF NOT EXISTS app_portfolio_analytics_visitor_id_idx ON app.portfolio_analytics (visitor_id);
CREATE INDEX IF NOT EXISTS app_portfolio_analytics_portfolio_event_date_idx ON app.portfolio_analytics (portfolio_id, event, createdAt);
CREATE INDEX IF NOT EXISTS app_portfolio_analytics_portfolio_date_idx ON app.portfolio_analytics (portfolio_id, createdAt);

CREATE INDEX IF NOT EXISTS app_certifications_owner_userId_idx ON app.certifications (owner_userId);
CREATE INDEX IF NOT EXISTS app_certifications_status_idx ON app.certifications (status);
CREATE INDEX IF NOT EXISTS app_certifications_category_idx ON app.certifications (category);
CREATE INDEX IF NOT EXISTS app_certifications_issue_date_idx ON app.certifications (issue_date);
CREATE INDEX IF NOT EXISTS app_certifications_expiration_date_idx ON app.certifications (expiration_date);
CREATE INDEX IF NOT EXISTS app_certifications_work_experience_id_idx ON app.certifications (work_experience_id);
CREATE INDEX IF NOT EXISTS app_certifications_owner_status_idx ON app.certifications (owner_userId, status);
CREATE INDEX IF NOT EXISTS app_certifications_owner_visible_idx ON app.certifications (owner_userId, is_visible);
CREATE INDEX IF NOT EXISTS app_certifications_owner_sort_idx ON app.certifications (owner_userId, sort_order, is_visible);

CREATE UNIQUE INDEX IF NOT EXISTS app_companies_owner_name_key ON app.companies (owner_userId, lower(name));
CREATE INDEX IF NOT EXISTS app_companies_industry_idx ON app.companies (industry);
CREATE INDEX IF NOT EXISTS app_companies_size_idx ON app.companies (size);

CREATE INDEX IF NOT EXISTS app_job_applications_owner_userId_idx ON app.job_applications (owner_userId);
CREATE INDEX IF NOT EXISTS app_job_applications_company_id_idx ON app.job_applications (company_id);
CREATE INDEX IF NOT EXISTS app_job_applications_status_idx ON app.job_applications (status);
CREATE INDEX IF NOT EXISTS app_job_applications_start_date_idx ON app.job_applications (start_date);
CREATE INDEX IF NOT EXISTS app_job_applications_application_date_idx ON app.job_applications (application_date);
CREATE INDEX IF NOT EXISTS app_job_applications_salary_final_idx ON app.job_applications (salary_final);
CREATE INDEX IF NOT EXISTS app_job_applications_source_idx ON app.job_applications (source);
CREATE INDEX IF NOT EXISTS app_job_applications_offer_date_idx ON app.job_applications (offer_date);
CREATE INDEX IF NOT EXISTS app_job_applications_owner_status_idx ON app.job_applications (owner_userId, status);
CREATE INDEX IF NOT EXISTS app_job_applications_owner_date_idx ON app.job_applications (owner_userId, start_date);
CREATE INDEX IF NOT EXISTS app_job_applications_owner_application_date_idx ON app.job_applications (owner_userId, application_date);
CREATE INDEX IF NOT EXISTS app_job_applications_owner_salary_idx ON app.job_applications (owner_userId, salary_final);
CREATE INDEX IF NOT EXISTS app_job_applications_status_salary_idx ON app.job_applications (status, salary_final);
CREATE INDEX IF NOT EXISTS app_job_applications_job_posting_url_idx ON app.job_applications (job_posting_url);

CREATE INDEX IF NOT EXISTS app_application_notes_application_id_idx ON app.application_notes (application_id);
CREATE INDEX IF NOT EXISTS app_application_notes_type_idx ON app.application_notes (type);
CREATE INDEX IF NOT EXISTS app_application_notes_createdAt_idx ON app.application_notes (createdAt);

CREATE INDEX IF NOT EXISTS app_application_files_application_id_idx ON app.application_files (application_id);
CREATE INDEX IF NOT EXISTS app_application_files_type_idx ON app.application_files (type);
CREATE INDEX IF NOT EXISTS app_application_files_createdAt_idx ON app.application_files (createdAt);

CREATE INDEX IF NOT EXISTS app_career_events_owner_userId_idx ON app.career_events (owner_userId);
CREATE INDEX IF NOT EXISTS app_career_events_work_experience_id_idx ON app.career_events (work_experience_id);
CREATE INDEX IF NOT EXISTS app_career_events_event_type_idx ON app.career_events (event_type);
CREATE INDEX IF NOT EXISTS app_career_events_event_date_idx ON app.career_events (event_date);
CREATE INDEX IF NOT EXISTS app_career_events_salary_increase_idx ON app.career_events (salary_increase);
CREATE INDEX IF NOT EXISTS app_career_events_owner_date_idx ON app.career_events (owner_userId, event_date);
CREATE INDEX IF NOT EXISTS app_career_events_owner_type_idx ON app.career_events (owner_userId, event_type);
CREATE INDEX IF NOT EXISTS app_career_events_timeline_idx ON app.career_events (owner_userId, event_date, event_type);

CREATE INDEX IF NOT EXISTS app_job_application_status_history_application_id_idx ON app.job_application_status_history (application_id);
CREATE INDEX IF NOT EXISTS app_job_application_status_history_application_changed_idx ON app.job_application_status_history (application_id, changed_at);

-- 3c.  Updated-at triggers  (excludes portfolio_stats and social_links)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_portfolios_set_updated_at') THEN
    CREATE TRIGGER app_portfolios_set_updated_at BEFORE UPDATE ON app.portfolios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_work_experiences_set_updated_at') THEN
    CREATE TRIGGER app_work_experiences_set_updated_at BEFORE UPDATE ON app.work_experiences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_projects_set_updated_at') THEN
    CREATE TRIGGER app_projects_set_updated_at BEFORE UPDATE ON app.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_skills_set_updated_at') THEN
    CREATE TRIGGER app_skills_set_updated_at BEFORE UPDATE ON app.skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_testimonials_set_updated_at') THEN
    CREATE TRIGGER app_testimonials_set_updated_at BEFORE UPDATE ON app.testimonials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_certifications_set_updated_at') THEN
    CREATE TRIGGER app_certifications_set_updated_at BEFORE UPDATE ON app.certifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_companies_set_updated_at') THEN
    CREATE TRIGGER app_companies_set_updated_at BEFORE UPDATE ON app.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_job_applications_set_updated_at') THEN
    CREATE TRIGGER app_job_applications_set_updated_at BEFORE UPDATE ON app.job_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_application_notes_set_updated_at') THEN
    CREATE TRIGGER app_application_notes_set_updated_at BEFORE UPDATE ON app.application_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_application_files_set_updated_at') THEN
    CREATE TRIGGER app_application_files_set_updated_at BEFORE UPDATE ON app.application_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_career_events_set_updated_at') THEN
    CREATE TRIGGER app_career_events_set_updated_at BEFORE UPDATE ON app.career_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 3d.  Status-change history trigger on job_applications (idempotent)
CREATE OR REPLACE FUNCTION app.log_job_application_status_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO app.job_application_status_history (application_id, previous_status, new_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_job_applications_log_status_change ON app.job_applications;
CREATE TRIGGER app_job_applications_log_status_change
  AFTER UPDATE ON app.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION app.log_job_application_status_change();

-- ---------------------------------------------------------------------------
-- 4.  Row-level security
-- ---------------------------------------------------------------------------

ALTER TABLE app.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolio_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.career_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_application_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (so we can re-create them idempotently)
-- Portfolios
DROP POLICY IF EXISTS app_portfolios_select_policy ON app.portfolios;
DROP POLICY IF EXISTS app_portfolios_owner_write_policy ON app.portfolios;
CREATE POLICY app_portfolios_select_policy ON app.portfolios
  FOR SELECT USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
    OR (is_public = true AND is_active = true)
  );
CREATE POLICY app_portfolios_owner_write_policy ON app.portfolios
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- Work experiences
DROP POLICY IF EXISTS app_work_experiences_select_policy ON app.work_experiences;
DROP POLICY IF EXISTS app_work_experiences_owner_write_policy ON app.work_experiences;
CREATE POLICY app_work_experiences_select_policy ON app.work_experiences
  FOR SELECT USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );
CREATE POLICY app_work_experiences_owner_write_policy ON app.work_experiences
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

-- Projects
DROP POLICY IF EXISTS app_projects_select_policy ON app.projects;
DROP POLICY IF EXISTS app_projects_owner_write_policy ON app.projects;
CREATE POLICY app_projects_select_policy ON app.projects
  FOR SELECT USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );
CREATE POLICY app_projects_owner_write_policy ON app.projects
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

-- Skills
DROP POLICY IF EXISTS app_skills_select_policy ON app.skills;
DROP POLICY IF EXISTS app_skills_owner_write_policy ON app.skills;
CREATE POLICY app_skills_select_policy ON app.skills
  FOR SELECT USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );
CREATE POLICY app_skills_owner_write_policy ON app.skills
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

-- Testimonials
DROP POLICY IF EXISTS app_testimonials_select_policy ON app.testimonials;
DROP POLICY IF EXISTS app_testimonials_owner_write_policy ON app.testimonials;
CREATE POLICY app_testimonials_select_policy ON app.testimonials
  FOR SELECT USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );
CREATE POLICY app_testimonials_owner_write_policy ON app.testimonials
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

-- Portfolio analytics
DROP POLICY IF EXISTS app_portfolio_analytics_select_policy ON app.portfolio_analytics;
DROP POLICY IF EXISTS app_portfolio_analytics_owner_write_policy ON app.portfolio_analytics;
CREATE POLICY app_portfolio_analytics_select_policy ON app.portfolio_analytics
  FOR SELECT USING (auth.is_portfolio_owner(portfolio_id));
CREATE POLICY app_portfolio_analytics_owner_write_policy ON app.portfolio_analytics
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

-- Certifications
DROP POLICY IF EXISTS app_certifications_owner_policy ON app.certifications;
CREATE POLICY app_certifications_owner_policy ON app.certifications
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- Companies
DROP POLICY IF EXISTS app_companies_owner_policy ON app.companies;
CREATE POLICY app_companies_owner_policy ON app.companies
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- Job applications
DROP POLICY IF EXISTS app_job_applications_select_policy ON app.job_applications;
DROP POLICY IF EXISTS app_job_applications_owner_write_policy ON app.job_applications;
CREATE POLICY app_job_applications_select_policy ON app.job_applications
  FOR SELECT USING (
    auth.is_service_role() OR owner_userId = auth.current_user_id()
  );
CREATE POLICY app_job_applications_owner_write_policy ON app.job_applications
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (
    auth.is_service_role()
    OR (
      owner_userId = auth.current_user_id()
      AND EXISTS (
        SELECT 1 FROM app.companies company
        WHERE company.id = company_id
          AND company.owner_userId = auth.current_user_id()
      )
    )
  );

-- Application notes
DROP POLICY IF EXISTS app_application_notes_select_policy ON app.application_notes;
DROP POLICY IF EXISTS app_application_notes_owner_write_policy ON app.application_notes;
CREATE POLICY app_application_notes_select_policy ON app.application_notes
  FOR SELECT USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );
CREATE POLICY app_application_notes_owner_write_policy ON app.application_notes
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );

-- Application files
DROP POLICY IF EXISTS app_application_files_select_policy ON app.application_files;
DROP POLICY IF EXISTS app_application_files_owner_write_policy ON app.application_files;
CREATE POLICY app_application_files_select_policy ON app.application_files
  FOR SELECT USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );
CREATE POLICY app_application_files_owner_write_policy ON app.application_files
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );

-- Career events
DROP POLICY IF EXISTS app_career_events_owner_policy ON app.career_events;
CREATE POLICY app_career_events_owner_policy ON app.career_events
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (
    auth.is_service_role()
    OR (
      owner_userId = auth.current_user_id()
      AND (
        work_experience_id IS NULL
        OR EXISTS (
          SELECT 1 FROM app.work_experiences work_experience
          JOIN app.portfolios portfolio ON portfolio.id = work_experience.portfolio_id
          WHERE work_experience.id = work_experience_id
            AND portfolio.owner_userId = auth.current_user_id()
        )
      )
    )
  );

-- User social links
DROP POLICY IF EXISTS app_user_social_links_select_policy ON app.user_social_links;
DROP POLICY IF EXISTS app_user_social_links_insert_policy ON app.user_social_links;
DROP POLICY IF EXISTS app_user_social_links_update_policy ON app.user_social_links;
DROP POLICY IF EXISTS app_user_social_links_delete_policy ON app.user_social_links;
CREATE POLICY app_user_social_links_select_policy ON app.user_social_links
  FOR SELECT USING (user_id = auth.current_user_id() OR auth.is_service_role());
CREATE POLICY app_user_social_links_insert_policy ON app.user_social_links
  FOR INSERT WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());
CREATE POLICY app_user_social_links_update_policy ON app.user_social_links
  FOR UPDATE
  USING (user_id = auth.current_user_id() OR auth.is_service_role())
  WITH CHECK (user_id = auth.current_user_id() OR auth.is_service_role());
CREATE POLICY app_user_social_links_delete_policy ON app.user_social_links
  FOR DELETE USING (user_id = auth.current_user_id() OR auth.is_service_role());

-- Job application status history
DROP POLICY IF EXISTS app_job_application_status_history_select_policy ON app.job_application_status_history;
DROP POLICY IF EXISTS app_job_application_status_history_owner_write_policy ON app.job_application_status_history;
CREATE POLICY app_job_application_status_history_select_policy ON app.job_application_status_history
  FOR SELECT USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );
CREATE POLICY app_job_application_status_history_owner_write_policy ON app.job_application_status_history
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.job_applications application
      WHERE application.id = application_id AND application.owner_userId = auth.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5.  Seed data
-- ---------------------------------------------------------------------------

-- 5a.  Dev user + portfolio
INSERT INTO "user" (id, name, email, "emailVerified")
SELECT 'dev-user-001', 'Charles Ponti', 'charles@ponti.io', true
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE id = 'dev-user-001');

INSERT INTO app.portfolios (
  id, owner_userId, slug, title, name, initials, job_title, bio, tagline,
  current_location, email, is_public, is_active
)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b',
  'dev-user-001',
  'charles-ponti',
  'Charles Ponti — Portfolio',
  'Charles Ponti',
  'CP',
  'Engineer & Builder',
  'Building products at the intersection of design, infrastructure, and taste. Previously led engineering teams across fintech, media, and enterprise SaaS.',
  'I build things that work.',
  'Los Angeles, CA',
  'charles@ponti.io',
  true, true
WHERE NOT EXISTS (SELECT 1 FROM app.portfolios WHERE id = '565a8da7-0258-48de-80c9-edbed5e72e5b');

INSERT INTO app.user_social_links (user_id, github, linkedin, twitter, website)
SELECT 'dev-user-001',
  'https://github.com/ponti-studios',
  'https://linkedin.com/in/charlesponti',
  'https://x.com/charlesponti',
  'https://ponti.io'
WHERE NOT EXISTS (SELECT 1 FROM app.user_social_links WHERE user_id = 'dev-user-001');

-- 5b.  Work experiences
INSERT INTO app.work_experiences (
  id, portfolio_id, role, company, description, start_date, end_date,
  employment_type, work_arrangement, seniority_level, is_visible, sort_order
)
SELECT v.id, '565a8da7-0258-48de-80c9-edbed5e72e5b',
  v.role, v.company, v.description,
  v.start_date::timestamptz, v.end_date::timestamptz,
  v.employment_type, v.work_arrangement, v.seniority_level, true, v.sort_order
FROM (VALUES
  ('we-ponti',         'Founder & CEO',             'Ponti Studios',     'Building experimental products across AI, media, and infrastructure.',                                '2022-01-01', NULL,             'full-time', 'remote', 'c-level',      1),
  ('we-humana',        'Staff Engineer',            'Humana',             'Led health platform architecture for 5M+ members.',                                                  '2020-03-01', '2021-12-31',    'full-time', 'remote', 'staff',       2),
  ('we-mimecast',      'Senior Software Engineer',  'Mimecast',           'Built cloud security infrastructure serving 40K+ businesses.',                                       '2017-06-01', '2020-02-29',    'full-time', 'office', 'senior',      3),
  ('we-sandp',         'Software Engineer',          'S&P Global',         'Developed financial data platforms and market intelligence tools.',                                   '2014-09-01', '2017-05-31',    'full-time', 'office', 'mid-level',   4),
  ('we-thomson',       'Software Engineer',          'Thomson Reuters',    'Built legal research and compliance platforms.',                                                      '2012-01-01', '2014-08-31',    'full-time', 'office', 'mid-level',   5),
  ('we-streamyard',    'Senior Engineer',            'StreamYard',         'Scaled live streaming infrastructure to support 1M+ concurrent viewers.',                             '2021-01-01', '2021-12-31',    'contract',  'remote', 'senior',      6)
) AS v(id, role, company, description, start_date, end_date, employment_type, work_arrangement, seniority_level, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM app.work_experiences WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b');

-- 5c.  Projects  (merged from seed-projects-and-testimonials.sql)
INSERT INTO app.projects (
  portfolio_id, work_experience_id, title, short_description, description, technologies,
  github_url, live_url, status, is_featured, is_visible, sort_order, start_date
)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b',
  (SELECT id FROM app.work_experiences
   WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b' AND company = v.company),
  v.title, v.short_description, v.description,
  v.technologies::jsonb, v.github_url, v.live_url, v.status, v.is_featured, true, v.sort_order,
  v.start_date::timestamptz
FROM (VALUES
  ('Craftd',     'Track applications, interviews, and your professional pipeline',
   'A web app for managing a job search pipeline — applications, interviews, follow-ups, and offers — in one place.',
   '["TypeScript", "React", "Hono", "PostgreSQL"]',
   'https://github.com/ponti-studios/hominem',
   'https://career.ponti.io',
   'completed', true, 1, '2026-06-16', 'Ponti Studios'),
  ('RealiTea',   'Daily word game built on real headlines',
   'A daily word puzzle where players guess real celebrity names by spelling them out from clues.',
   '["TypeScript", "React", "React Router", "PostgreSQL", "Drizzle"]',
   'https://github.com/ponti-studios/labs',
   'https://ponti.io/games/realitea',
   'completed', true, 2, '2026-06-23', 'Thomson Reuters'),
  ('Earth',      'Live map for exploring London traffic cameras',
   'A live geospatial viewer for browsing London''s TfL traffic camera network on an interactive map.',
   '["TypeScript", "React", "MapLibre", "PostgreSQL"]',
   'https://github.com/ponti-studios/labs',
   NULL,
   'in-progress', false, 3, '2026-03-04', 'Mimecast'),
  ('Health',     'Personal workspace for symptoms, care, and medication',
   'A personal health workspace for understanding symptoms, tracking progress, and organizing care.',
   '["TypeScript", "React", "React Router", "SQLite"]',
   'https://github.com/ponti-studios/labs',
   NULL,
   'in-progress', false, 4, '2026-04-20', 'Humana'),
  ('Commune',    'Anonymous peer deliberation for difficult decisions',
   'A social decision-making app that turns a personal situation into a neutral case for a small anonymous jury.',
   '["TypeScript", "React", "PostgreSQL", "AI"]',
   'https://github.com/ponti-studios/labs',
   NULL,
   'in-progress', false, 5, '2026-05-06', 'StreamYard'),
  ('Foundation', 'Enterprise shared infrastructure with Docker & PostgreSQL',
   'Shared infrastructure tooling for provisioning and running Docker and PostgreSQL services across projects.',
   '["Docker", "PostgreSQL", "GitHub Actions"]',
   'https://github.com/ponti-studios/foundation',
   NULL,
   'completed', false, 6, NULL, 'S&P Global')
) AS v(title, short_description, description, technologies, github_url, live_url, status, is_featured, sort_order, start_date, company)
WHERE NOT EXISTS (
  SELECT 1 FROM app.projects WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b'
);

-- 5d.  Testimonials  (merged from seed-projects-and-testimonials.sql)
INSERT INTO app.testimonials (
  portfolio_id, name, title, company, content, rating, is_verified, is_visible, sort_order
)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b',
  v.name, v.title, v.company, v.content, v.rating, false, true, v.sort_order
FROM (VALUES
  ('Maya R.',   'Engineering Manager', 'Airbnb',
   'Charles shipped our onboarding redesign in half the time we''d scoped, and it held up perfectly under production load. Rare to find someone who moves that fast without cutting corners.',
   5, 1),
  ('Devon K.',  'Product Lead',         'Netflix',
   'One of the few engineers I''ve worked with who can go from a rough product idea to a working prototype in a single sprint.',
   5, 2),
  ('Priya S.',  'Staff Engineer',       'Reddit',
   'He rebuilt our recommendation pipeline end-to-end and cut infra costs by a meaningful margin in the process.',
   5, 3),
  ('Jordan T.', 'VP Engineering',       'HubSpot',
   'Sharp technical judgment, and even sharper at explaining it to non-technical stakeholders.',
   5, 4),
  ('Sam L.',    'Founder',              'Seed-stage startup',
   'Brought us from a rough prototype to production-ready in six weeks flat.',
   5, 5)
) AS v(name, title, company, content, rating, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM app.testimonials WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b'
);

-- 5e.  Skills
INSERT INTO app.skills (portfolio_id, name, level, category, sort_order, is_visible)
SELECT '565a8da7-0258-48de-80c9-edbed5e72e5b', v.name, v.level, v.category, v.sort_order, true
FROM (VALUES
  ('TypeScript',     95, 'language',       1),
  ('React',          92, 'frontend',       2),
  ('PostgreSQL',     88, 'backend',       3),
  ('React Native',   85, 'mobile',        4),
  ('Node.js',        90, 'backend',       5),
  ('Docker',         82, 'devops',         6),
  ('Python',         75, 'language',       7),
  ('Swift',          65, 'mobile',         8),
  ('AWS',            78, 'devops',         9),
  ('GraphQL',        80, 'backend',       10)
) AS v(name, level, category, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM app.skills WHERE portfolio_id = '565a8da7-0258-48de-80c9-edbed5e72e5b'
);

-- 5f.  Companies + job applications
INSERT INTO app.companies (owner_userid, name)
VALUES
  ('dev-user-001', 'Airbnb'),
  ('dev-user-001', 'AllTrails'),
  ('dev-user-001', 'Amazon'),
  ('dev-user-001', 'Bask Health'),
  ('dev-user-001', 'BuildOps'),
  ('dev-user-001', 'CTP'),
  ('dev-user-001', 'Canva'),
  ('dev-user-001', 'Chance App'),
  ('dev-user-001', 'Change.org'),
  ('dev-user-001', 'Charthop'),
  ('dev-user-001', 'Clear Point Consultants'),
  ('dev-user-001', 'Clear Point'),
  ('dev-user-001', 'Coinbase'),
  ('dev-user-001', 'Creator Club'),
  ('dev-user-001', 'Duro'),
  ('dev-user-001', 'EliseAI'),
  ('dev-user-001', 'Empatico'),
  ('dev-user-001', 'Epsilon Records / AudioKit'),
  ('dev-user-001', 'EvenUp'),
  ('dev-user-001', 'FIGS'),
  ('dev-user-001', 'FINESSE'),
  ('dev-user-001', 'Fabric Labs'),
  ('dev-user-001', 'Faire'),
  ('dev-user-001', 'FairyGodBoss'),
  ('dev-user-001', 'Fanfix'),
  ('dev-user-001', 'Farmdrop'),
  ('dev-user-001', 'Figma'),
  ('dev-user-001', 'Flex'),
  ('dev-user-001', 'Forward Health'),
  ('dev-user-001', 'Function Health'),
  ('dev-user-001', 'Ghost'),
  ('dev-user-001', 'Github'),
  ('dev-user-001', 'Goldman Sachs'),
  ('dev-user-001', 'Good Day Farm'),
  ('dev-user-001', 'Guideline'),
  ('dev-user-001', 'Harry''s'),
  ('dev-user-001', 'Headspace'),
  ('dev-user-001', 'Homes.com'),
  ('dev-user-001', 'Hopper'),
  ('dev-user-001', 'Howrecruit'),
  ('dev-user-001', 'HubSpot'),
  ('dev-user-001', 'Jobot'),
  ('dev-user-001', 'Lab49'),
  ('dev-user-001', 'Lightspark'),
  ('dev-user-001', 'LinkedIn'),
  ('dev-user-001', 'Luminate'),
  ('dev-user-001', 'Makespace'),
  ('dev-user-001', 'Mavely by Later'),
  ('dev-user-001', 'Mavely'),
  ('dev-user-001', 'Metalab'),
  ('dev-user-001', 'Metropolis Technologies'),
  ('dev-user-001', 'NBC Universal'),
  ('dev-user-001', 'Needle'),
  ('dev-user-001', 'Netflix'),
  ('dev-user-001', 'New York Times'),
  ('dev-user-001', 'Newsweek'),
  ('dev-user-001', 'Oliver Wyman'),
  ('dev-user-001', 'Onetera'),
  ('dev-user-001', 'Pager'),
  ('dev-user-001', 'Patagonia'),
  ('dev-user-001', 'Peony.Ink'),
  ('dev-user-001', 'Peony.lnk'),
  ('dev-user-001', 'Pinterest'),
  ('dev-user-001', 'Posh'),
  ('dev-user-001', 'Producto'),
  ('dev-user-001', 'Prologue'),
  ('dev-user-001', 'Quilt'),
  ('dev-user-001', 'Reddit'),
  ('dev-user-001', 'Remo'),
  ('dev-user-001', 'Resend'),
  ('dev-user-001', 'Rhino'),
  ('dev-user-001', 'Riverside'),
  ('dev-user-001', 'Samsung TV Plus'),
  ('dev-user-001', 'Samsung'),
  ('dev-user-001', 'Sensay'),
  ('dev-user-001', 'Serotonin'),
  ('dev-user-001', 'Snapchat'),
  ('dev-user-001', 'Spotter'),
  ('dev-user-001', 'Squarespace'),
  ('dev-user-001', 'Storm2'),
  ('dev-user-001', 'Stubhub'),
  ('dev-user-001', 'Substack'),
  ('dev-user-001', 'Tasty'),
  ('dev-user-001', 'Tatari'),
  ('dev-user-001', 'ThreadBeast'),
  ('dev-user-001', 'Tomo'),
  ('dev-user-001', 'Tubi'),
  ('dev-user-001', 'Twitch'),
  ('dev-user-001', 'Two Chairs'),
  ('dev-user-001', 'Vendigo'),
  ('dev-user-001', 'Venue Platform, Inc.'),
  ('dev-user-001', 'Vimeo'),
  ('dev-user-001', 'Warner Bros Discovery'),
  ('dev-user-001', 'Wealthfront'),
  ('dev-user-001', 'Webflow'),
  ('dev-user-001', 'Writer'),
  ('dev-user-001', 'Zume')
ON CONFLICT (owner_userid, lower(name)) DO UPDATE SET updatedat = now();

INSERT INTO app.job_applications (
  owner_userid, company_id, position, status, start_date, location, source, link,
  application_date, company_notes, response_date, salary_quoted, createdat, updatedat
)
SELECT
  'dev-user-001', c.id, ja.position, ja.status, ja.start_date, ja.location,
  ja.source, ja.link, ja.application_date, ja.company_notes,
  ja.response_date, ja.salary_quoted, ja.createdat, ja.updatedat
FROM (VALUES
  ('Change.org', 'Senior Product Manager', 'APPLIED', '2024-12-12T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-12T00:00:00.000Z'::timestamptz, NULL, '2013-10-16T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Airbnb', 'Software Engineer', 'REJECTED', '2025-01-02T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-02T00:00:00.000Z'::timestamptz, NULL, '2019-04-19T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Lab49', 'Software Engineer', 'REJECTED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2019-04-29T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Onetera', 'Software Engineer', 'APPLIED', '2025-02-23T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-23T00:00:00.000Z'::timestamptz, NULL, '2020-02-15T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Newsweek', 'Product Manager', 'APPLIED', '2024-12-11T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-11T00:00:00.000Z'::timestamptz, NULL, '2020-05-21T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Canva', 'Software Engineer', 'APPLIED', '2024-05-08T07:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2024-05-08T07:00:00.000Z'::timestamptz, NULL, '2020-07-08T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Storm2', 'Product Manager', 'APPLIED', '2025-01-11T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-11T00:00:00.000Z'::timestamptz, NULL, '2020-07-04T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Figma', 'Software Engineer', 'APPLIED', '2024-12-09T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-09T00:00:00.000Z'::timestamptz, NULL, '2020-07-15T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Vendigo', 'Software Engineer', 'WITHDRAWN', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2020-07-06T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Zume', 'Software Engineer', 'REJECTED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2020-07-15T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('FairyGodBoss', 'Software Engineer', 'REJECTED', '2020-07-27T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-07-27T00:00:00.000Z'::timestamptz, NULL, '2020-08-04T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Fanfix', 'Senior Backend Software Engineer', 'APPLIED', '2025-01-20T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-20T00:00:00.000Z'::timestamptz, NULL, '2020-08-11T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Rhino', 'Software Engineer', 'REJECTED', '2020-06-17T00:00:00.000Z'::timestamptz, 'Remote', 'glassdoor', NULL, '2020-06-17T00:00:00.000Z'::timestamptz, NULL, '2024-05-16T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Charthop', 'Software Engineer', 'REJECTED', '2020-06-25T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2020-06-25T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Producto', 'Senior Product Manager - HealthTech/Pharma Chatbot', 'APPLIED', '2024-12-10T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-10T00:00:00.000Z'::timestamptz, NULL, '2024-05-16T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Goldman Sachs', 'Software Engineer', 'REJECTED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2024-05-25T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Warner Bros Discovery', 'Software Engineer', 'REJECTED', '2024-11-18T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2024-11-18T00:00:00.000Z'::timestamptz, NULL, '2024-05-22T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('NBC Universal', 'Software Engineer', 'APPLIED', '2025-02-22T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-22T00:00:00.000Z'::timestamptz, NULL, '2024-08-16T00:00:00.000Z'::timestamptz, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Resend', 'Software Engineer', 'REJECTED', '2025-01-29T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2025-01-29T00:00:00.000Z'::timestamptz, NULL, '2024-11-25T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Peony.Ink', 'Software Engineer', 'WITHDRAWN', '2024-05-14T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-05-14T00:00:00.000Z'::timestamptz, NULL, '2024-11-25T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Remo', 'Software Engineer', 'APPLIED', '2025-02-23T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-23T00:00:00.000Z'::timestamptz, NULL, '2024-11-30T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Amazon', 'Software Engineer', 'APPLIED', '2025-01-14T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2025-01-14T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Snapchat', 'Software Engineer', 'APPLIED', '2025-01-16T00:00:00.000Z'::timestamptz, 'Remote', 'recruiter', NULL, '2025-01-16T00:00:00.000Z'::timestamptz, NULL, '2024-12-04T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Tomo', 'Principal Software Engineer, Front End', 'APPLIED', '2025-02-20T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-20T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Airbnb', 'Software Engineer', 'APPLIED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, 'Imported from Notion: https://www.notion.so/18a1c08cf4f98014a1c1d4cfa0d7c136?pvs=21', NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Squarespace', 'Software Engineer', 'REJECTED', '2024-11-14T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-11-14T00:00:00.000Z'::timestamptz, NULL, NULL, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('FIGS', 'Software Engineer II, Frontend', 'APPLIED', '2025-02-14T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-14T00:00:00.000Z'::timestamptz, NULL, '2024-12-12T00:00:00.000Z'::timestamptz, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Jobot', 'Senior Product Manager', 'APPLIED', '2025-01-06T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-06T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Substack', 'Software Engineer', 'APPLIED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, NULL, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Lightspark', 'Software Engineer', 'APPLIED', '2025-01-22T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-22T00:00:00.000Z'::timestamptz, NULL, '2024-12-14T00:00:00.000Z'::timestamptz, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('AllTrails', 'Software Engineer', 'REJECTED', '2024-05-08T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-05-08T00:00:00.000Z'::timestamptz, NULL, '2024-12-15T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('BuildOps', 'Software Engineer', 'APPLIED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Prologue', 'Software Engineer', 'PHONE_SCREEN', '2024-05-11T07:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-05-11T07:00:00.000Z'::timestamptz, NULL, '2025-01-13T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Reddit', 'Software Engineer', 'APPLIED', '2025-01-03T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-03T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('LinkedIn', 'Product Manager, Feed Relevance', 'APPLIED', '2025-01-06T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-06T00:00:00.000Z'::timestamptz, NULL, '2025-01-11T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Clear Point', 'Software Engineer', 'APPLIED', '2025-01-11T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-11T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Empatico', 'Software Engineer', 'REJECTED', '2020-06-25T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-06-25T00:00:00.000Z'::timestamptz, NULL, '2025-01-20T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Function Health', 'Software Engineer', 'APPLIED', '2025-02-12T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2025-02-12T00:00:00.000Z'::timestamptz, NULL, '2025-01-09T00:00:00.000Z'::timestamptz, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Pager', 'Software Engineer', 'REJECTED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Spotter', 'Software Engineer', 'APPLIED', '2025-02-19T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-19T00:00:00.000Z'::timestamptz, NULL, NULL, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Tatari', 'Software Engineer', 'APPLIED', '2024-12-02T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-02T00:00:00.000Z'::timestamptz, NULL, '2025-01-10T00:00:00.000Z'::timestamptz, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('CTP', 'Product Manager', 'APPLIED', '2024-12-10T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-10T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Vimeo', 'Software Engineer', 'APPLIED', '2025-01-06T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-06T00:00:00.000Z'::timestamptz, NULL, '2025-01-15T00:00:00.000Z'::timestamptz, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Makespace', 'Software Engineer', 'REJECTED', '2020-06-19T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-06-19T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Github', 'Software Engineer', 'REJECTED', '2020-07-27T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-07-27T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('EliseAI', 'Software Engineer', 'APPLIED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Faire', 'Software Engineer', 'REJECTED', '2025-02-09T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-09T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Good Day Farm', 'Front-End Software Engineer', 'APPLIED', '2025-02-17T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-17T00:00:00.000Z'::timestamptz, NULL, '2025-01-23T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('EvenUp', 'Software Engineer', 'REJECTED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, '2025-01-20T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Writer', 'Software Engineer', 'REJECTED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'recruiter', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, '2025-01-29T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Stubhub', 'Software Engineer', 'REJECTED', '2025-01-04T00:00:00.000Z'::timestamptz, 'Remote', 'indeed', NULL, '2025-01-04T00:00:00.000Z'::timestamptz, NULL, '2025-02-02T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Serotonin', 'Software Engineer', 'APPLIED', '2025-02-23T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-23T00:00:00.000Z'::timestamptz, NULL, '2025-01-27T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Metalab', 'Software Engineer', 'APPLIED', '2025-02-18T00:00:00.000Z'::timestamptz, 'Remote', 'indeed', NULL, '2025-02-18T00:00:00.000Z'::timestamptz, NULL, '2025-01-31T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Webflow', 'Software Engineer', 'REJECTED', '2025-02-13T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-13T00:00:00.000Z'::timestamptz, NULL, '2025-01-19T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Fabric Labs', 'Software Engineer', 'REJECTED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2025-01-17T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Samsung', 'Software Engineer', 'APPLIED', '2025-01-20T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-20T00:00:00.000Z'::timestamptz, NULL, NULL, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Farmdrop', 'Software Engineer', 'WITHDRAWN', '2013-10-11T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2013-10-11T00:00:00.000Z'::timestamptz, NULL, '2025-01-24T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Harry''s', 'Software Engineer', 'REJECTED', '2020-06-25T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-06-25T00:00:00.000Z'::timestamptz, NULL, '2025-01-23T00:00:00.000Z'::timestamptz, '$140,000 - $185,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('HubSpot', 'Software Engineer', 'APPLIED', '2025-01-09T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-09T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Twitch', 'Software Engineer', 'APPLIED', '2024-12-02T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-02T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('ThreadBeast', 'Senior Product Manager', 'APPLIED', '2024-12-10T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-10T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Ghost', 'Software Engineer', 'APPLIED', '2025-02-18T00:00:00.000Z'::timestamptz, 'Remote', 'indeed', NULL, '2025-02-18T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Luminate', 'Software Engineer', 'APPLIED', '2025-01-21T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-21T00:00:00.000Z'::timestamptz, NULL, '2025-02-07T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Patagonia', 'Software Engineer', 'REJECTED', '2025-02-01T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2025-02-01T00:00:00.000Z'::timestamptz, NULL, '2025-02-16T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Tasty', 'Frontend Developer', 'APPLIED', '2025-02-14T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-02-14T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Netflix', 'Software Engineer', 'APPLIED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'referral', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Mavely', 'Software Engineer', 'APPLIED', '2025-01-06T00:00:00.000Z'::timestamptz, 'Remote', 'wellfound', NULL, '2025-01-06T00:00:00.000Z'::timestamptz, NULL, '2025-01-29T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Epsilon Records / AudioKit', 'Software Engineer', 'REJECTED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'indeed', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Pinterest', 'Software Engineer', 'APPLIED', '2025-01-15T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-15T00:00:00.000Z'::timestamptz, NULL, '2025-02-06T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Oliver Wyman', 'Software Engineer', 'REJECTED', '2020-05-05T00:00:00.000Z'::timestamptz, 'Remote', 'glassdoor', NULL, '2020-05-05T00:00:00.000Z'::timestamptz, NULL, '2025-02-12T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Hopper', 'Senior Product Manager, Capital One Travel Customer Experience', 'REJECTED', '2025-01-06T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-06T00:00:00.000Z'::timestamptz, NULL, NULL, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Riverside', 'Software Engineer', 'APPLIED', '2024-12-02T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-12-02T00:00:00.000Z'::timestamptz, NULL, '2025-02-19T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Peony.lnk', 'Software Engineer', 'PHONE_SCREEN', '2024-05-14T07:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2024-05-14T07:00:00.000Z'::timestamptz, NULL, NULL, '$150,000 - $195,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Guideline', 'Software Engineer', 'APPLIED', '2025-02-20T00:00:00.000Z'::timestamptz, 'Remote', 'indeed', NULL, '2025-02-20T00:00:00.000Z'::timestamptz, NULL, '2025-02-17T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Forward Health', 'Software Engineer', 'REJECTED', '2019-04-02T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2019-04-02T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Quilt', 'Software Engineer', 'WITHDRAWN', '2019-04-18T00:00:00.000Z'::timestamptz, 'Remote', 'company_website', NULL, '2019-04-18T00:00:00.000Z'::timestamptz, NULL, '2025-02-23T00:00:00.000Z'::timestamptz, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Flex', 'Software Engineer', 'APPLIED', '2025-01-28T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2025-01-28T00:00:00.000Z'::timestamptz, NULL, NULL, '$110,000 - $155,000', '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('New York Times', 'Software Engineer', 'REJECTED', '2020-02-03T00:00:00.000Z'::timestamptz, 'Remote', 'linkedin', NULL, '2020-02-03T00:00:00.000Z'::timestamptz, NULL, NULL, NULL, '2026-03-02T10:05:34.866Z'::timestamptz, '2026-03-02T10:05:34.866Z'::timestamptz),
  ('Wealthfront', 'Software Engineer, Frontend', 'APPLIED', '2025-03-18T01:05:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4159642752', '2025-03-18T01:05:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Duro', 'Product Manager', 'APPLIED', '2024-08-15T20:06:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/3991549039', '2024-08-15T20:06:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-02-20T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Sensay', 'Senior Full Stack / Team Lead', 'APPLIED', '2025-02-07T02:58:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4131812167', '2025-02-07T02:58:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('FINESSE', 'Senior Technical Product Manager', 'APPLIED', '2024-11-28T19:03:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4051257374', '2024-11-28T19:03:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, NULL, '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Tubi', 'Senior Frontend Software Engineer, ReactJS', 'APPLIED', '2025-02-28T22:10:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4160582383', '2025-02-28T22:10:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, NULL, '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Metropolis Technologies', 'Senior Web Engineer, Customer Experience', 'APPLIED', '2025-11-26T19:20:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4295073085', '2025-11-26T19:20:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-02-24T00:00:00.000Z'::timestamptz, '$175,000 - $230,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Coinbase', 'Crypto Product Manager II - Consumer', 'APPLIED', '2024-12-10T21:03:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4076661091', '2024-12-10T21:03:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Samsung TV Plus', 'Product Manager, Consumer Experience, Samsung TV Plus', 'APPLIED', '2025-01-20T17:51:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4127882017', '2025-01-20T17:51:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Homes.com', 'Homes.com - Lead Software Engineer (vue/C#/.Net)', 'APPLIED', '2024-12-12T21:42:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4095499852', '2024-12-12T21:42:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Two Chairs', 'Senior Software Engineer', 'APPLIED', '2025-03-10T18:02:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4122634272', '2025-03-10T18:02:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Chance App', 'Founding Backend Engineer', 'APPLIED', '2025-01-21T00:23:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4104882106', '2025-01-21T00:23:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$175,000 - $230,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Bask Health', 'Senior Frontend Developer', 'APPLIED', '2025-12-03T19:13:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4321972606', '2025-12-03T19:13:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Creator Club', 'Senior Product Manager', 'APPLIED', '2025-01-29T18:20:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4138251361', '2025-01-29T18:20:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Headspace', 'Senior Software Engineer, API', 'APPLIED', '2025-03-01T21:22:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4144546616', '2025-03-01T21:22:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-03-04T00:00:00.000Z'::timestamptz, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Howrecruit', 'Senior Software Engineer', 'APPLIED', '2025-03-06T18:40:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4176977244', '2025-03-06T18:40:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Clear Point Consultants', 'Startup Software Engineer', 'APPLIED', '2025-01-12T03:33:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4122424847', '2025-01-12T03:33:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, NULL, '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Venue Platform, Inc.', 'Senior Software Engineer', 'APPLIED', '2025-03-05T21:15:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4175201107', '2025-03-05T21:15:00.000Z'::timestamptz, 'Email: cj@ponti.io', NULL, NULL, '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Mavely by Later', 'Senior Product Manager', 'APPLIED', '2025-01-06T19:17:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4108327600', '2025-01-06T19:17:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-03-19T00:00:00.000Z'::timestamptz, '$110,000 - $155,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Posh', 'Staff Full Stack Software Engineer', 'APPLIED', '2025-02-27T20:55:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4152432408', '2025-02-27T20:55:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-11-29T00:00:00.000Z'::timestamptz, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz),
  ('Needle', 'Senior Software Engineer', 'APPLIED', '2025-02-28T22:32:00.000Z'::timestamptz, 'Remote', 'linkedin', 'http://www.linkedin.com/jobs/view/4170601461', '2025-02-28T22:32:00.000Z'::timestamptz, 'Email: cj@ponti.io', '2025-12-04T00:00:00.000Z'::timestamptz, '$150,000 - $195,000', '2026-06-30T02:07:18.000Z'::timestamptz, '2026-06-30T02:07:18.000Z'::timestamptz)
) AS ja(company_name, position, status, start_date, location, source, link, application_date, company_notes, response_date, salary_quoted, createdat, updatedat)
JOIN app.companies c ON c.owner_userid = 'dev-user-001' AND lower(c.name) = lower(ja.company_name)
WHERE NOT EXISTS (SELECT 1 FROM app.job_applications WHERE owner_userid = 'dev-user-001');

COMMIT;
