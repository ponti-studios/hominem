# Job Applications Data Injection Script

This script imports job application data from `job-applications.csv` into the career database.

## Prerequisites

Make sure the database is running and migrated:

```bash
pnpm --filter @hominem/career db:up
pnpm --filter @hominem/career db:migrate
```

Update `scripts/inject-job-applications.ts` with the target user email and name before running it.

## Usage

```bash
pnpm --filter @hominem/career db:inject-jobs
```

The script parses the CSV, creates or finds the target user, creates company records, and imports job applications. Rows with missing position or company data are skipped.
