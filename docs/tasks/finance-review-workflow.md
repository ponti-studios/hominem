---
title: 'MCP monthly finance review workflow and evals'
status: 'Implemented'
priority: 'medium'
labels: [finance, mcp, evals]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

Provide a user-selectable monthly finance review workflow for MCP clients and an eval suite
that checks period grounding, currency separation, read-only tool use, and clarification when
the requested month is missing.

## Acceptance criteria

- [x] `monthly_finance_review` is available only to tokens with `finance:read`.
- [x] The prompt requires a calendar month before querying when none is supplied.
- [x] The workflow uses monthly stats, category spending, and top merchants for the same month.
- [x] The workflow never changes finance data and never combines different currencies.
- [x] MCP integration tests prove scope visibility and prompt contents.
- [x] Model evals cover a complete review, mixed currencies, and a missing month.
- [x] Validation and eval evidence are recorded below.

## Evidence

`just evals run mcp-monthly-review` passed all three scenarios on 2026-10-15 with
`openai/gpt-5-mini` and judge `openai/gpt-oss-20b` (minimum score 0.7). The eval verified
September 2026 report calls and dates, clarification without calls when the month is missing,
and a mixed GBP/USD report with currency boundaries preserved. MCP integration coverage verifies
read-scope visibility and read-only prompt instructions. `pnpm run check` and `pnpm format:check`
passed.
