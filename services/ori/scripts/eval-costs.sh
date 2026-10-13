#!/usr/bin/env bash
set -uo pipefail

# Runs every Ori eval suite individually and reports each one's cost and outcome.
# `ori eval` prints, per invocation: a `pass`/`FAIL` test line, per-run `$cost`
# lines, and a "candidates $X / judge $Y" spend summary. Running one .eval.ts at
# a time turns that into a per-suite breakdown. Correctness counts graded
# candidate runs (`pass`/`FAIL` lines that carry a model slug); `outcome?` runs
# (no asserted outcome) are ungraded. The tests column counts Bun test verdicts,
# which can fail on custom harness checks even when Ori did not grade the run.
# mcp-agent-protocol.eval.ts is a deterministic bun test (no model calls) and is
# skipped.
#
# Usage: just evals costs [suite-name ...]

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
EVALS_DIR="$ROOT_DIR/services/ori/evals"
OUT_DIR="$ROOT_DIR/services/ori/eval-costs"

set -a; source "$ROOT_DIR/services/api/.env"; set +a

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RESULT_FILE="$OUT_DIR/$STAMP.json"
LOG_DIR="$OUT_DIR/$STAMP.logs"
mkdir -p "$LOG_DIR"

suites=()
for f in "$EVALS_DIR"/*.eval.ts; do
  [[ "$(basename "$f")" == "mcp-agent-protocol.eval.ts" ]] && continue
  name="$(basename "$f" .eval.ts)"
  # Optional positional args narrow the run to those suite basenames.
  if [[ $# -gt 0 ]] && [[ " $* " != *" $name "* ]]; then
    continue
  fi
  suites+=("$f")
done

json_rows=""
grand_cand=0
grand_judge=0

printf '%-28s %5s %8s %8s %8s %10s %10s %10s\n' "suite" "result" "graded" "ungraded" "tests" "candidates" "judge" "total"
printf '%s\n' "---------------------------------------------------------------------------------------------------------------------"

for f in "${suites[@]}"; do
  name="$(basename "$f" .eval.ts)"
  log="$LOG_DIR/$name.log"
  out="$(ori eval "$f" --human 2>&1)"
  rc=$?
  printf '%s\n' "$out" > "$log"

  # Sum the per-run "$X" costs. Candidate run lines carry a model slug and a
  # latency (for example, "pass  openai/gpt-5-mini  9612ms"); judge run lines
  # start with "judge". Requiring both fields keeps dollar amounts in failure
  # details, summary lines, and source-text excerpts out of the totals.
  cand="$(printf '%s\n' "$out" | grep -E '^(pass|FAIL|outcome\?) +[^[:space:]/]*/[^[:space:]]* +[0-9]+ms' | grep -oE '\$[0-9.]+' | tr -d '$' | awk '{s += $1} END { printf "%.6f", s + 0 }')"
  judge="$(printf '%s\n' "$out" | grep -E '^judge +[^[:space:]/]*/[^[:space:]]* +[0-9]+ms' | grep -oE '\$[0-9.]+' | tr -d '$' | awk '{s += $1} END { printf "%.6f", s + 0 }')"

  # Graded candidate runs: `pass`/`FAIL` lines carrying a model slug and latency.
  # `outcome?` lines have no asserted outcome and are counted separately.
  passed="$(printf '%s\n' "$out" | grep -cE '^pass +[^[:space:]/]*/[^[:space:]]* +[0-9]+ms')"
  failed="$(printf '%s\n' "$out" | grep -cE '^FAIL +[^[:space:]/]*/[^[:space:]]* +[0-9]+ms')"
  ungraded="$(printf '%s\n' "$out" | grep -cE '^outcome\? +[^[:space:]/]*/[^[:space:]]* +[0-9]+ms')"
  test_passed="$(printf '%s\n' "$out" | grep -cE '^pass +[^/]*[0-9]+ms$')"
  test_failed="$(printf '%s\n' "$out" | grep -cE '^FAIL +[^/]*[0-9]+ms$')"
  graded=$((passed + failed))

  result=$([[ $rc -eq 0 ]] && echo pass || echo fail)
  if [[ $graded -gt 0 ]]; then
    correct="$passed/$graded"
  else
    correct="—"
  fi
  tests="$test_passed/$((test_passed + test_failed))"

  cand="${cand:-0.000000}"
  judge="${judge:-0.000000}"
  total="$(awk -v a="$cand" -v b="$judge" 'BEGIN { printf "%.6f", a + b }')"

  printf '%-28s %5s %8s %8s %8s %10s %10s %10s\n' "$name" "$result" "$correct" "$ungraded" "$tests" "\$$cand" "\$$judge" "\$$total"

  grand_cand="$(awk -v a="$grand_cand" -v b="$cand" 'BEGIN { printf "%.6f", a + b }')"
  grand_judge="$(awk -v a="$grand_judge" -v b="$judge" 'BEGIN { printf "%.6f", a + b }')"

  [[ -n "$json_rows" ]] && json_rows="$json_rows,"
  json_rows="$json_rows  {\"suite\":\"$name\",\"result\":\"$result\",\"passed\":$passed,\"failed\":$failed,\"ungraded\":$ungraded,\"testsPassed\":$test_passed,\"testsFailed\":$test_failed,\"candidates\":$cand,\"judge\":$judge,\"total\":$total,\"log\":\"$STAMP.logs/$name.log\"}"
done

grand_total="$(awk -v a="$grand_cand" -v b="$grand_judge" 'BEGIN { printf "%.6f", a + b }')"
printf '%s\n' "---------------------------------------------------------------------------------------------------------------------"
printf '%-28s %5s %8s %8s %8s %10s %10s %10s\n' "TOTAL" "" "" "" "" "\$$grand_cand" "\$$grand_judge" "\$$grand_total"

cat > "$RESULT_FILE" <<EOF
{
  "timestamp": "$STAMP",
  "candidates": $grand_cand,
  "judge": $grand_judge,
  "total": $grand_total,
  "suites": [
$json_rows
  ]
}
EOF

printf '\nbreakdown saved: %s\n' "$RESULT_FILE"
