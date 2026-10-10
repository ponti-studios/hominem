ROOT_DIR := justfile_directory()
ENV_FILE := ROOT_DIR / "services/api/.env"
JOB_IMPORT_FIXTURE := ROOT_DIR / "services/ori/evals/career/job-import/fixtures/whatnot-ai-tooling-engineer-posting.html"
JOB_IMPORT_ORG := "whatnot"
JOB_IMPORT_POSTING_ID := "7cfa0536-94de-42b7-9fe7-d646f4addc29"

_run suite:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source '{{ ENV_FILE }}'; set +a
    pnpm --filter @hominem/ori "eval:{{ suite }}"

# Run every eval suite.
all: (_run "all")

# Run one suite by name — see the recipes below for available names.
run suite: (_run suite)

# Persona/tone rubric — does the assistant hold its blunt, direct voice?
chat-assistant: (_run "chat-assistant")

# Normal-conversation baseline — response quality, token usage, cost, and latency.
chat-baseline: (_run "chat-baseline")

# Offer-comparison extraction — compensation, benefits, and profile details.
career-offer-extraction: (_run "career-offer-extraction")

# Voice transcript cleanup — filler removal without losing meaning.
voice-cleanup: (_run "voice-cleanup")

# Voice task extraction — priority/due-date inference using the current prompt.
voice-task-extraction: (_run "voice-task-extraction")

# Time-block extraction — intent, temporal grounding, no-invention. Iterate here.
time-block-regression: (_run "time-block-regression")

# Time-block extraction — held-out release gate. Run only after selecting a prompt/model candidate.
time-block-holdout: (_run "time-block-holdout")

# Cross-domain routing — does the model call the appropriate tool only when needed?
mcp-tool-routing: (_run "mcp-tool-routing")

# Cross-domain tool workflows — dependent reads, conditional writes, and confirmation.
mcp-workflow-planning: (_run "mcp-workflow-planning")

# Monthly finance review — period grounding, read-only behavior, and currency safety.
mcp-monthly-review: (_run "mcp-monthly-review")

# Travel presence — countries explained by stops, layovers, visits, and residence evidence.
mcp-travel-presence: (_run "mcp-travel-presence")

# Career job-import extraction against the checked-in Whatnot/Ashby fixture.
career-job-import: (_run "career-job-import")

# Typecheck every eval suite, case dataset, and test file.
typecheck:
    pnpm --filter @hominem/ori typecheck
