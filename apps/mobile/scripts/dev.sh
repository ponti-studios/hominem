#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

SCRIPTS_DIR="$(dirname "$0")"

header "Development Server"

step "Running verification checks..."
bash "$SCRIPTS_DIR/verify.sh" dev

step "Starting development server..."
bash "$SCRIPTS_DIR/internal/run-variant.sh" dev expo start --dev-client
