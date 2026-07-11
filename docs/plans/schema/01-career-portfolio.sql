-- Up: career/job-search domain plus the platform's only intentionally public data (app.portfolios).
CREATE TABLE app.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (length(btrim(slug)) BETWEEN 3 AND 50 AND slug ~ '^[a-z0-9-]+$'), title text NOT NULL CHECK (btrim(title) <> ''),
  is_public boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
  name text NOT NULL CHECK (btrim(name) <> ''), initials text, job_title text NOT NULL CHECK (btrim(job_title) <> ''),
  bio text NOT NULL CHECK (btrim(bio) <> ''), tagline text NOT NULL CHECK (btrim(tagline) <> ''), current_location text NOT NULL CHECK (btrim(current_location) <> ''),
  availability_status boolean NOT NULL DEFAULT false, open_to_remote boolean NOT NULL DEFAULT false,
  email text NOT NULL CHECK (btrim(email) <> ''), phone text, copyright text, profile_image_url text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(), UNIQUE (slug)
);
CREATE TABLE app.portfolio_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('view','contact_click','project_click','skill_click','social_click','download_resume','copy_email')),
  path text, visitor_id text, ip_address text, user_agent text, referer text, country text, city text, metadata jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), website text, industry text, size integer CHECK (size IS NULL OR size >= 0), location text, description text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (btrim(role) <> ''), company text NOT NULL CHECK (btrim(company) <> ''), description text NOT NULL CHECK (btrim(description) <> ''),
  start_date timestamptz, end_date timestamptz, employment_type text NOT NULL DEFAULT 'full-time' CHECK (employment_type IN ('full-time','part-time','contract','freelance','internship','temporary')),
  work_arrangement text NOT NULL DEFAULT 'office' CHECK (work_arrangement IN ('office','remote','hybrid','travel')), seniority_level text, department text,
  -- highly sensitive: base_salary/signing_bonus/annual_bonus/salary_range/bonus_history/reports_to/team_size/direct_reports/reason_for_leaving/exit_notes
  -- must never reach a public portfolio route or external AI by default -- see chapter privacy note.
  base_salary integer CHECK (base_salary IS NULL OR base_salary >= 0), currency text NOT NULL DEFAULT 'USD', salary_range jsonb,
  signing_bonus integer CHECK (signing_bonus IS NULL OR signing_bonus >= 0), annual_bonus integer CHECK (annual_bonus IS NULL OR annual_bonus >= 0),
  bonus_history jsonb NOT NULL DEFAULT '[]', benefits jsonb, team_size integer CHECK (team_size IS NULL OR team_size >= 0), reports_to text,
  direct_reports integer NOT NULL DEFAULT 0 CHECK (direct_reports >= 0), performance_ratings jsonb NOT NULL DEFAULT '[]', salary_adjustments jsonb NOT NULL DEFAULT '[]',
  reason_for_leaving text, exit_notes text, is_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0), metadata jsonb,
  -- presentational/legacy portfolio-card fields, not otherwise governed by this chapter's invariants:
  image text, gradient text, metrics text, action text, tags jsonb NOT NULL DEFAULT '[]',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (btrim(title) <> ''), description text NOT NULL CHECK (btrim(description) <> ''), short_description text,
  live_url text, github_url text, image_url text, video_url text, technologies jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in-progress','completed','archived')), start_date timestamptz, end_date timestamptz,
  is_featured boolean NOT NULL DEFAULT false, is_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE app.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), level integer NOT NULL CHECK (level BETWEEN 1 AND 100), category text, icon text, description text,
  years_of_experience integer CHECK (years_of_experience IS NULL OR years_of_experience >= 0), ai_derived boolean NOT NULL DEFAULT false, proof text,
  is_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (btrim(name) <> ''), description text, issuing_organization text NOT NULL CHECK (btrim(issuing_organization) <> ''),
  issue_date timestamptz NOT NULL, expiration_date timestamptz, next_renewal_date timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','pending_renewal','archived')), category text, cost integer CHECK (cost IS NULL OR cost >= 0),
  is_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (expiration_date IS NULL OR expiration_date >= issue_date)
);
CREATE TABLE app.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), title text, company text, content text NOT NULL CHECK (btrim(content) <> ''),
  avatar_url text, linkedin_url text, rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  is_verified boolean NOT NULL DEFAULT false, is_visible boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.goals (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''), description text, target_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.key_results (
  id uuid PRIMARY KEY DEFAULT uuidv7(), goal_id uuid NOT NULL REFERENCES app.goals(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''), target_value numeric(12,2), current_value numeric(12,2), unit text, due_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
-- job_applications and career_events carry compensation detail; highly sensitive, see chapter privacy note.
CREATE TABLE app.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  "position" text NOT NULL CHECK (btrim("position") <> ''),
  status text NOT NULL CHECK (status IN ('APPLIED','PHONE_SCREEN','INTERVIEW','FINAL_INTERVIEW','OFFER','ACCEPTED','REJECTED','WITHDRAWN')),
  start_date timestamptz NOT NULL, end_date timestamptz, location text, job_posting text, job_posting_url text, job_posting_word_count integer CHECK (job_posting_word_count IS NULL OR job_posting_word_count >= 0),
  requirements jsonb NOT NULL DEFAULT '[]', skills jsonb NOT NULL DEFAULT '[]',
  salary_quoted text, salary_accepted text, salary_expected integer CHECK (salary_expected IS NULL OR salary_expected >= 0), salary_requested integer CHECK (salary_requested IS NULL OR salary_requested >= 0), salary_offered integer CHECK (salary_offered IS NULL OR salary_offered >= 0),
  salary_negotiated integer CHECK (salary_negotiated IS NULL OR salary_negotiated >= 0), salary_final integer CHECK (salary_final IS NULL OR salary_final >= 0),
  total_comp_offered integer CHECK (total_comp_offered IS NULL OR total_comp_offered >= 0), total_comp_final integer CHECK (total_comp_final IS NULL OR total_comp_final >= 0),
  equity_offered text, equity_final text, bonus_offered integer CHECK (bonus_offered IS NULL OR bonus_offered >= 0), bonus_final integer CHECK (bonus_final IS NULL OR bonus_final >= 0),
  source text, application_date timestamptz, response_date timestamptz, first_interview_date timestamptz, offer_date timestamptz, decision_date timestamptz,
  rejection_reason text, withdrawal_reason text,
  time_to_response integer CHECK (time_to_response IS NULL OR time_to_response >= 0), time_to_first_interview integer CHECK (time_to_first_interview IS NULL OR time_to_first_interview >= 0),
  time_to_offer integer CHECK (time_to_offer IS NULL OR time_to_offer >= 0), time_to_decision integer CHECK (time_to_decision IS NULL OR time_to_decision >= 0),
  cover_letter text, resume text, job_id text, link text, phone_screen text, reference boolean NOT NULL DEFAULT false, interview_dates jsonb NOT NULL DEFAULT '[]',
  recruiter_name text, recruiter_email text, recruiter_linkedin text, company_notes text, negotiation_notes text, stages jsonb NOT NULL DEFAULT '[]',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE TABLE app.application_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('resume','cover_letter','portfolio','offer_letter','other')), file_name text NOT NULL CHECK (btrim(file_name) <> ''),
  file_url text, file_content text, mime_type text, file_size integer CHECK (file_size IS NULL OR file_size >= 0),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('general','interview','feedback','research','follow_up')), title text, content text NOT NULL CHECK (btrim(content) <> ''),
  is_private boolean NOT NULL DEFAULT true, createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.career_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, work_experience_id uuid REFERENCES app.work_experiences(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('promotion','raise','bonus','equity_grant','role_change','department_change','location_change','performance_review','goal_achievement','skill_milestone','manager_change','team_expansion')),
  event_date timestamptz NOT NULL, previous_title text, new_title text, previous_level text, new_level text,
  previous_salary integer, new_salary integer, salary_increase integer, increase_percentage text,
  previous_total_comp integer, new_total_comp integer, total_comp_increase integer,
  equity_granted integer CHECK (equity_granted IS NULL OR equity_granted >= 0), equity_vesting text,
  bonus_amount integer CHECK (bonus_amount IS NULL OR bonus_amount >= 0), bonus_type text CHECK (bonus_type IS NULL OR bonus_type IN ('annual','performance','retention','signing','spot','referral','project')),
  description text, achievements jsonb NOT NULL DEFAULT '[]', skills_gained jsonb NOT NULL DEFAULT '[]',
  performance_rating text, manager_feedback text, self_assessment text, market_salary_range jsonb, career_goals jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
