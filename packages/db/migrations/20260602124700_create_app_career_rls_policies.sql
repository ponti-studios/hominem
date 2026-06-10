-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION auth.is_portfolio_owner(target_portfolio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
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
LANGUAGE sql
STABLE
AS $$
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

ALTER TABLE app.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolio_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolio_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.career_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_portfolios_select_policy ON app.portfolios
  FOR SELECT
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
    OR (is_public = true AND is_active = true)
  );

CREATE POLICY app_portfolios_owner_write_policy ON app.portfolios
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  );

CREATE POLICY app_work_experiences_select_policy ON app.work_experiences
  FOR SELECT
  USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );

CREATE POLICY app_work_experiences_owner_write_policy ON app.work_experiences
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_projects_select_policy ON app.projects
  FOR SELECT
  USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );

CREATE POLICY app_projects_owner_write_policy ON app.projects
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_skills_select_policy ON app.skills
  FOR SELECT
  USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );

CREATE POLICY app_skills_owner_write_policy ON app.skills
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_social_links_select_policy ON app.social_links
  FOR SELECT
  USING (auth.can_read_portfolio(portfolio_id));

CREATE POLICY app_social_links_owner_write_policy ON app.social_links
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_testimonials_select_policy ON app.testimonials
  FOR SELECT
  USING (
    auth.is_portfolio_owner(portfolio_id)
    OR (is_visible = true AND auth.can_read_portfolio(portfolio_id))
  );

CREATE POLICY app_testimonials_owner_write_policy ON app.testimonials
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_portfolio_stats_select_policy ON app.portfolio_stats
  FOR SELECT
  USING (auth.can_read_portfolio(portfolio_id));

CREATE POLICY app_portfolio_stats_owner_write_policy ON app.portfolio_stats
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_portfolio_analytics_select_policy ON app.portfolio_analytics
  FOR SELECT
  USING (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_portfolio_analytics_owner_write_policy ON app.portfolio_analytics
  FOR ALL
  USING (auth.is_portfolio_owner(portfolio_id))
  WITH CHECK (auth.is_portfolio_owner(portfolio_id));

CREATE POLICY app_certifications_owner_policy ON app.certifications
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  );

CREATE POLICY app_companies_owner_policy ON app.companies
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  );

CREATE POLICY app_job_applications_select_policy ON app.job_applications
  FOR SELECT
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  );

CREATE POLICY app_job_applications_owner_write_policy ON app.job_applications
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR (
      owner_userId = auth.current_user_id()
      AND EXISTS (
        SELECT 1
        FROM app.companies company
        WHERE company.id = company_id
          AND company.owner_userId = auth.current_user_id()
      )
    )
  );

CREATE POLICY app_application_notes_select_policy ON app.application_notes
  FOR SELECT
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_application_notes_owner_write_policy ON app.application_notes
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_application_files_select_policy ON app.application_files
  FOR SELECT
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_application_files_owner_write_policy ON app.application_files
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.job_applications application
      WHERE application.id = application_id
        AND application.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_career_events_owner_policy ON app.career_events
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR (
      owner_userId = auth.current_user_id()
      AND (
        work_experience_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM app.work_experiences work_experience
          JOIN app.portfolios portfolio
            ON portfolio.id = work_experience.portfolio_id
          WHERE work_experience.id = work_experience_id
            AND portfolio.owner_userId = auth.current_user_id()
        )
      )
    )
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS app_career_events_owner_policy ON app.career_events;
DROP POLICY IF EXISTS app_application_files_owner_write_policy ON app.application_files;
DROP POLICY IF EXISTS app_application_files_select_policy ON app.application_files;
DROP POLICY IF EXISTS app_application_notes_owner_write_policy ON app.application_notes;
DROP POLICY IF EXISTS app_application_notes_select_policy ON app.application_notes;
DROP POLICY IF EXISTS app_job_applications_owner_write_policy ON app.job_applications;
DROP POLICY IF EXISTS app_job_applications_select_policy ON app.job_applications;
DROP POLICY IF EXISTS app_companies_owner_policy ON app.companies;
DROP POLICY IF EXISTS app_certifications_owner_policy ON app.certifications;
DROP POLICY IF EXISTS app_portfolio_analytics_owner_write_policy ON app.portfolio_analytics;
DROP POLICY IF EXISTS app_portfolio_analytics_select_policy ON app.portfolio_analytics;
DROP POLICY IF EXISTS app_portfolio_stats_owner_write_policy ON app.portfolio_stats;
DROP POLICY IF EXISTS app_portfolio_stats_select_policy ON app.portfolio_stats;
DROP POLICY IF EXISTS app_testimonials_owner_write_policy ON app.testimonials;
DROP POLICY IF EXISTS app_testimonials_select_policy ON app.testimonials;
DROP POLICY IF EXISTS app_social_links_owner_write_policy ON app.social_links;
DROP POLICY IF EXISTS app_social_links_select_policy ON app.social_links;
DROP POLICY IF EXISTS app_skills_owner_write_policy ON app.skills;
DROP POLICY IF EXISTS app_skills_select_policy ON app.skills;
DROP POLICY IF EXISTS app_projects_owner_write_policy ON app.projects;
DROP POLICY IF EXISTS app_projects_select_policy ON app.projects;
DROP POLICY IF EXISTS app_work_experiences_owner_write_policy ON app.work_experiences;
DROP POLICY IF EXISTS app_work_experiences_select_policy ON app.work_experiences;
DROP POLICY IF EXISTS app_portfolios_owner_write_policy ON app.portfolios;
DROP POLICY IF EXISTS app_portfolios_select_policy ON app.portfolios;

ALTER TABLE app.career_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.application_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.certifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolio_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolio_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.testimonials DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.social_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.work_experiences DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.portfolios DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS auth.can_read_portfolio(uuid);
DROP FUNCTION IF EXISTS auth.is_portfolio_owner(uuid);
-- +goose StatementEnd
