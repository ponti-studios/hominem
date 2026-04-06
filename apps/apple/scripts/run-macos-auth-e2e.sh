#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
API_PORT="${HOMINEM_E2E_API_PORT:-4040}"
API_BASE_URL="${HOMINEM_E2E_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
AUTH_TEST_SECRET="${HOMINEM_E2E_AUTH_TEST_SECRET:-otp-secret}"
BETTER_AUTH_SECRET_VALUE="${BETTER_AUTH_SECRET:-better-auth-test-secret-local-only}"
DATABASE_URL_VALUE="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:4433/hominem-test}"
RESEND_API_KEY_VALUE="${RESEND_API_KEY:-re_test_key}"
RESEND_FROM_EMAIL_VALUE="${RESEND_FROM_EMAIL:-noreply@hominem.test}"
RESEND_FROM_NAME_VALUE="${RESEND_FROM_NAME:-Hominem Test}"
SEND_EMAILS_VALUE="${SEND_EMAILS:-false}"
DERIVED_DATA_PATH="${HOMINEM_E2E_DERIVED_DATA_PATH:-}"
API_LOG_PATH="${HOMINEM_E2E_API_LOG_PATH:-}"

API_PID=""
CREATED_DERIVED_DATA_PATH=""
CREATED_API_LOG_PATH=""

if [[ -z "${DERIVED_DATA_PATH}" ]]; then
  DERIVED_DATA_PATH="$(mktemp -d "${TMPDIR%/}/hominem-apple-macos-e2e.XXXXXX")"
  CREATED_DERIVED_DATA_PATH="${DERIVED_DATA_PATH}"
fi

if [[ -z "${API_LOG_PATH}" ]]; then
  API_LOG_PATH="$(mktemp "${TMPDIR%/}/hominem-apple-macos-e2e-api.XXXXXX")"
  CREATED_API_LOG_PATH="${API_LOG_PATH}"
fi

cleanup() {
  local exit_code=$?

  pkill -x HominemAppleMac >/dev/null 2>&1 || true
  pkill -x HominemAppleMacE2E-Runner >/dev/null 2>&1 || true

  if [[ -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" >/dev/null 2>&1 || true
  fi

  (
    cd "${ROOT_DIR}/services/api"
    NODE_ENV=test \
    DATABASE_URL="${DATABASE_URL_VALUE}" \
    AUTH_TEST_OTP_ENABLED=true \
    AUTH_E2E_SECRET="${AUTH_TEST_SECRET}" \
    BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET_VALUE}" \
    RESEND_API_KEY="${RESEND_API_KEY_VALUE}" \
    RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL_VALUE}" \
    RESEND_FROM_NAME="${RESEND_FROM_NAME_VALUE}" \
    SEND_EMAILS="${SEND_EMAILS_VALUE}" \
    bun test/scripts/cleanup-auth-state.ts >/dev/null 2>&1 || true
  )

  if [[ ${exit_code} -eq 0 && -n "${CREATED_DERIVED_DATA_PATH}" ]]; then
    rm -rf "${CREATED_DERIVED_DATA_PATH}"
  fi

  if [[ ${exit_code} -eq 0 && -n "${CREATED_API_LOG_PATH}" ]]; then
    rm -f "${CREATED_API_LOG_PATH}"
  fi

  if [[ ${exit_code} -ne 0 ]]; then
    echo "macOS E2E failed."
    echo "API log: ${API_LOG_PATH}"
    echo "Derived data: ${DERIVED_DATA_PATH}"
  fi
}

trap cleanup EXIT

cd "${ROOT_DIR}"

pkill -x HominemAppleMac >/dev/null 2>&1 || true
pkill -x HominemAppleMacE2E-Runner >/dev/null 2>&1 || true

(
  cd "${ROOT_DIR}/services/api"
  NODE_ENV=test \
  PORT="${API_PORT}" \
  API_URL="${API_BASE_URL}" \
  DATABASE_URL="${DATABASE_URL_VALUE}" \
  AUTH_TEST_OTP_ENABLED=true \
  AUTH_E2E_SECRET="${AUTH_TEST_SECRET}" \
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET_VALUE}" \
  RESEND_API_KEY="${RESEND_API_KEY_VALUE}" \
  RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL_VALUE}" \
  RESEND_FROM_NAME="${RESEND_FROM_NAME_VALUE}" \
  SEND_EMAILS="${SEND_EMAILS_VALUE}" \
  bun test/scripts/cleanup-auth-state.ts
)

echo "Starting API at ${API_BASE_URL}"

(
  cd "${ROOT_DIR}/services/api"
  NODE_ENV=test \
  PORT="${API_PORT}" \
  API_URL="${API_BASE_URL}" \
  DATABASE_URL="${DATABASE_URL_VALUE}" \
  AUTH_TEST_OTP_ENABLED=true \
  AUTH_E2E_SECRET="${AUTH_TEST_SECRET}" \
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET_VALUE}" \
  RESEND_API_KEY="${RESEND_API_KEY_VALUE}" \
  RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL_VALUE}" \
  RESEND_FROM_NAME="${RESEND_FROM_NAME_VALUE}" \
  SEND_EMAILS="${SEND_EMAILS_VALUE}" \
  bun src/index.ts >"${API_LOG_PATH}" 2>&1
) &
API_PID=$!

for _ in {1..60}; do
  if curl --silent --fail "${API_BASE_URL}/api/status" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl --silent --fail "${API_BASE_URL}/api/status" >/dev/null; then
  echo "API did not become ready. See ${API_LOG_PATH}."
  exit 1
fi

(
  cd "${ROOT_DIR}/apps/apple"
  echo "Generating Xcode project"
  xcodegen generate >/dev/null
)

echo "Running macOS auth E2E"

HOMINEM_E2E_API_BASE_URL="${API_BASE_URL}" \
HOMINEM_E2E_AUTH_TEST_SECRET="${AUTH_TEST_SECRET}" \
xcodebuild \
  -project "${ROOT_DIR}/apps/apple/HominemApple.xcodeproj" \
  -scheme HominemAppleMac \
  -destination 'platform=macOS' \
  -derivedDataPath "${DERIVED_DATA_PATH}" \
  AD_HOC_CODE_SIGNING_ALLOWED=YES \
  CODE_SIGN_IDENTITY=- \
  test
