#!/bin/bash
# Pre-Push CI Validation Script
# Validates environment and runs appropriate tests before pushing to avoid wasting CI credits
# Detects what changed and runs only relevant validation steps

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
VALIDATION_FAILED=0
VALIDATION_PASSED=0
START_TIME=$(date +%s)

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Pre-Push CI Validation${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_section() {
  local section=$1
  echo -e "${CYAN}▶ $section${NC}"
}

print_step() {
  local step=$1
  echo -e "  ${CYAN}→${NC} $step"
}

run_command() {
  local description=$1
  local command=$2
  local indent=${3:-"  "}

  echo "${indent}${CYAN}→${NC} $description..."
  local start=$(date +%s)

  # Run command and capture output
  local output
  if output=$(eval "$command" 2>&1); then
    local end=$(date +%s)
    local duration=$((end - start))
    echo "${indent}${GREEN}✓${NC} $description [${duration}s]"
    return 0
  else
    local end=$(date +%s)
    local duration=$((end - start))
    echo "${indent}${RED}✗${NC} $description [${duration}s]"
    echo "$output" | sed "s/^/${indent}  /"
    return 1
  fi
}

detect_changes() {
  print_section "Detecting Changes"

  # Get the merge base with main
  local main_branch="main"
  if ! git rev-parse --verify "$main_branch" &>/dev/null; then
    main_branch="master"
  fi

  if ! git rev-parse --verify HEAD &>/dev/null; then
    echo -e "${YELLOW}ℹ Not in a git repository or detached HEAD${NC}"
    echo "  → Running full validation"
    echo "web api mobile db" # Default to all
    return
  fi

  # Get changed files relative to main
  local changed_files
  changed_files=$(git diff --name-only "$main_branch"...HEAD 2>/dev/null || git diff --name-only HEAD~10...HEAD 2>/dev/null || git diff --name-only HEAD)

  print_step "Changed files detected"

  local changes_detected=""

  if echo "$changed_files" | grep -qE "^apps/web/|^packages/.*web|^packages/.*ui"; then
    changes_detected="${changes_detected}web "
    echo "    • Web app"
  fi

  if echo "$changed_files" | grep -qE "^services/api|^packages/.*auth|^packages/.*rpc"; then
    changes_detected="${changes_detected}api "
    echo "    • API / Backend"
  fi

  if echo "$changed_files" | grep -qE "^apps/mobile/"; then
    changes_detected="${changes_detected}mobile "
    echo "    • Mobile app"
  fi

  if echo "$changed_files" | grep -qE "^apps/apple|^apps/desktop|^apps/cli"; then
    changes_detected="${changes_detected}platforms "
    echo "    • Native platforms"
  fi

  if echo "$changed_files" | grep -qE "^packages/platform/db|migrations|\.sql"; then
    changes_detected="${changes_detected}db "
    echo "    • Database / Migrations"
  fi

  if echo "$changed_files" | grep -qE "^infra|docker|compose"; then
    changes_detected="${changes_detected}infra "
    echo "    • Infrastructure"
  fi

  # If nothing specific detected, run full validation
  if [ -z "$changes_detected" ]; then
    changes_detected="web api mobile db"
    echo "    • All areas (generic changes)"
  fi

  echo "$changes_detected"
}

validate_environment() {
  print_section "Validating Environment"

  if [ ! -x "./scripts/check-ci-environment.sh" ]; then
    chmod +x ./scripts/check-ci-environment.sh
  fi

  if ! ./scripts/check-ci-environment.sh; then
    echo -e "${RED}✗ Environment validation failed${NC}"
    echo "  → Fix the issues above and retry"
    exit 1
  fi
}

run_validations() {
  local changes=$1

  print_section "Running Validation Commands"

  # Always run format, lint, typecheck, and build
  run_command "Formatting code" "just format"
  if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi

  run_command "Linting" "just lint"
  if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi

  run_command "Type checking" "just typecheck"
  if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi

  run_command "Building" "just build"
  if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi

  # Run targeted tests based on changes
  if echo "$changes" | grep -q "web"; then
    echo ""
    print_step "Running web-specific tests"
    run_command "Web checks" "just check-web" "    "
    if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi
  fi

  if echo "$changes" | grep -q "api"; then
    echo ""
    print_step "Running API tests"
    run_command "API checks" "just check-api" "    "
    if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi
  fi

  if echo "$changes" | grep -q "mobile"; then
    echo ""
    print_step "Running mobile tests"
    run_command "Mobile type check" "cd apps/mobile && bun run typecheck" "    "
    if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi

    run_command "Mobile unit tests" "cd apps/mobile && bun run test:unit" "    "
    if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi
  fi

  if echo "$changes" | grep -q "db"; then
    echo ""
    print_step "Running database validation"
    run_command "Validate migrations" "just db-migrations-validate" "    "
    if [ $? -ne 0 ]; then VALIDATION_FAILED=$((VALIDATION_FAILED + 1)); fi
  fi
}

print_summary() {
  local end_time=$(date +%s)
  local duration=$((end_time - START_TIME))
  local minutes=$((duration / 60))
  local seconds=$((duration % 60))

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "Total time: ${CYAN}${minutes}m ${seconds}s${NC}"

  if [ $VALIDATION_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    echo -e "${GREEN}✓ Safe to push to remote repository.${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    return 0
  else
    echo -e "${RED}✗ $VALIDATION_FAILED validation(s) failed${NC}"
    echo -e "${RED}✗ Fix issues above and retry before pushing${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    return 1
  fi
}

main() {
  print_header

  # Step 1: Validate environment
  validate_environment
  echo ""

  # Step 2: Detect changes
  local detected_changes
  detected_changes=$(detect_changes)
  echo ""

  # Step 3: Run validations
  run_validations "$detected_changes"
  echo ""

  # Step 4: Print summary
  print_summary
}

main "$@"
