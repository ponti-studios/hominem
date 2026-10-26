-- +goose Up
-- +goose StatementBegin

-- salary_expectation was stored in cents while salary_min/salary_max are whole currency units,
-- which made the career tools easy to misuse. Everything is whole units per year now.
UPDATE app.career_applications
SET salary_expectation = ROUND(salary_expectation / 100.0)::integer
WHERE salary_expectation IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

UPDATE app.career_applications
SET salary_expectation = salary_expectation * 100
WHERE salary_expectation IS NOT NULL;

-- +goose StatementEnd
