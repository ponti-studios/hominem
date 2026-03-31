#!/usr/bin/env bash
set -euo pipefail

# Run a command with a mobile variant loaded.
# Development variants source local env files; release variants are blocked here.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
RELEASE_ENV_POLICY="${MOBILE_DIR}/config/release-env-policy.js"

if [[ $# -lt 2 ]]; then
  echo "usage: with-variant.sh <variant> <command> [args...]" >&2
  exit 1
fi

VARIANT="$1"
shift

# Preview and production must come from EAS-managed env so local shells cannot drift from CI.
CAN_USE_LOCAL_ENV="$(node -e "const { canUseLocalEnvFile } = require('${RELEASE_ENV_POLICY}'); process.stdout.write(canUseLocalEnvFile('${VARIANT}') ? 'true' : 'false')")"

if [[ "${CAN_USE_LOCAL_ENV}" != "true" ]]; then
  echo "variant ${VARIANT} must use EAS-managed env and cannot source a local env file" >&2
  exit 1
fi

case "${VARIANT}" in
  dev)
    ENV_FILE="${MOBILE_DIR}/.env.development.local"
    ;;
  e2e)
    ENV_FILE="${MOBILE_DIR}/.env.e2e.local"
    ;;
  *)
    echo "unsupported variant: ${VARIANT}" >&2
    exit 1
    ;;
esac

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "missing env file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

export APP_VARIANT="${VARIANT}"
export EXPO_NO_DOTENV=1

exec "$@"
