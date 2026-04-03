#!/usr/bin/env bash
set -euo pipefail

lane="${1:-}"
shift || true

run_jest() {
  local -a files=("$@")

  if [ "${#files[@]}" -eq 0 ]; then
    echo "No test files matched."
    exit 1
  fi

  npx jest --runTestsByPath "${files[@]}"
}

case "$lane" in
  logic|unit)
    files=()
    while IFS= read -r file; do
      files+=("$file")
    done < <(
      {
        find lib -type f -name '*.test.ts'
        find utils -type f -name '*.test.ts'
        find tests -type f -name '*.test.ts' \
          ! -path 'tests/contracts/*' \
          ! -path 'tests/routes/*' \
          ! -path 'tests/screens/*' \
          ! -path 'tests/components/*'
      } | sort
    )
    run_jest "${files[@]}"
    ;;
  render)
    files=()
    while IFS= read -r file; do
      files+=("$file")
    done < <(
      {
        find tests/routes -type f -name '*.test.tsx' 2>/dev/null
        find tests/screens -type f -name '*.test.tsx'
        find tests/components -type f -name '*.test.tsx'
      } | sort
    )
    run_jest "${files[@]}"
    ;;
  contracts)
    files=()
    while IFS= read -r file; do
      files+=("$file")
    done < <(find tests/contracts -type f -name '*.test.ts' | sort)
    run_jest "${files[@]}"
    ;;
  file)
    if [ "${#@}" -eq 0 ]; then
      echo "Usage: bash scripts/internal/run-jest-lane.sh file <test-path> [more-paths...]"
      exit 1
    fi
    run_jest "$@"
    ;;
  *)
    echo "Usage: bash scripts/internal/run-jest-lane.sh <logic|render|contracts|file> [paths...]"
    exit 1
    ;;
esac
