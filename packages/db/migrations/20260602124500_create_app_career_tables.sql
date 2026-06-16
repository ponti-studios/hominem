-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.portfolios (
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
  location_tagline text,
  availability_status boolean NOT NULL DEFAULT false,
  availability_message text,
  email text NOT NULL,
  phone text,
  theme jsonb,
  copyright text,
  profile_image_url text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.work_experiences (
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
  total_compensation integer,
  equity_value integer,
  equity_percentage text,
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

CREATE TABLE app.projects (
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

CREATE TABLE app.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer NOT NULL,
  category text,
  icon text,
  description text,
  years_of_experience integer,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  github text,
  linkedin text,
  twitter text,
  website text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.testimonials (
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

CREATE TABLE app.portfolio_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES app.portfolios(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.portfolio_analytics (
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

CREATE TABLE app.certifications (
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

CREATE TABLE app.companies (
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

CREATE TABLE app.job_applications (
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

CREATE TABLE app.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  content text NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.application_files (
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

CREATE TABLE app.career_events (
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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.career_events;
DROP TABLE IF EXISTS app.application_files;
DROP TABLE IF EXISTS app.application_notes;
DROP TABLE IF EXISTS app.job_applications;
DROP TABLE IF EXISTS app.companies;
DROP TABLE IF EXISTS app.certifications;
DROP TABLE IF EXISTS app.portfolio_analytics;
DROP TABLE IF EXISTS app.portfolio_stats;
DROP TABLE IF EXISTS app.testimonials;
DROP TABLE IF EXISTS app.social_links;
DROP TABLE IF EXISTS app.skills;
DROP TABLE IF EXISTS app.projects;
DROP TABLE IF EXISTS app.work_experiences;
DROP TABLE IF EXISTS app.portfolios;
-- +goose StatementEnd
