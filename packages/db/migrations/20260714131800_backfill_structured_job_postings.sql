-- +goose Up
-- +goose StatementBegin

CREATE OR REPLACE FUNCTION pg_temp.try_parse_jsonb(input text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN input::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

WITH parsed AS (
  SELECT
    company_id,
    pg_temp.try_parse_jsonb(job_posting) AS payload
  FROM app.job_applications
  WHERE job_posting IS NOT NULL
),
normalized AS (
  SELECT DISTINCT ON (company_id)
    company_id,
    NULLIF(payload->>'companyDescription', '') AS company_description
  FROM parsed
  WHERE jsonb_typeof(payload) = 'object'
    AND NULLIF(payload->>'companyDescription', '') IS NOT NULL
  ORDER BY company_id
)
UPDATE app.companies AS company
SET
  description = normalized.company_description,
  updatedAt = now()
FROM normalized
WHERE company.id = normalized.company_id
  AND company.description IS NULL;

WITH parsed AS (
  SELECT
    id,
    pg_temp.try_parse_jsonb(job_posting) AS payload
  FROM app.job_applications
  WHERE job_posting IS NOT NULL
),
normalized AS (
  SELECT
    id,
    NULLIF(COALESCE(payload->>'jobDescription', payload->>'fullText'), '') AS job_posting,
    CASE
      WHEN jsonb_typeof(payload->'requirements') = 'array' THEN payload->'requirements'
      ELSE NULL
    END AS requirements,
    CASE
      WHEN jsonb_typeof(payload->'skills') = 'array' THEN payload->'skills'
      ELSE NULL
    END AS skills,
    NULLIF(payload->>'url', '') AS job_posting_url,
    CASE
      WHEN payload->>'wordCount' ~ '^[0-9]+$' THEN (payload->>'wordCount')::integer
      ELSE NULL
    END AS job_posting_word_count,
    NULLIF(payload->>'companyDescription', '') AS company_description
  FROM parsed
  WHERE jsonb_typeof(payload) = 'object'
)
UPDATE app.job_applications AS application
SET
  job_posting = COALESCE(normalized.job_posting, application.job_posting),
  requirements = COALESCE(normalized.requirements, application.requirements),
  skills = COALESCE(normalized.skills, application.skills),
  job_posting_url = COALESCE(normalized.job_posting_url, application.job_posting_url),
  job_posting_word_count = COALESCE(
    normalized.job_posting_word_count,
    CASE
      WHEN normalized.job_posting IS NULL THEN application.job_posting_word_count
      ELSE array_length(regexp_split_to_array(trim(normalized.job_posting), '\s+'), 1)
    END
  ),
  updatedAt = now()
FROM normalized
WHERE application.id = normalized.id;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Data backfill only. The original JSON blob is intentionally not reconstructed.

-- +goose StatementEnd
