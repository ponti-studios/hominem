#!/usr/bin/env bash
# Tests for just/deploy.sh with a stubbed `railway` binary and a fake status page; no network.
# Run: bash just/deploy.test.sh   (or: just test-deploy)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0

# A fake HOME holding a stub railway CLI. The stub behaves per STUB_MODE.
mkdir -p "$WORK/home/.railway/bin"
cat >"$WORK/home/.railway/bin/railway" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  up)
    if [[ "${STUB_MODE:-}" == upload-fails ]]; then
      echo "Error: failed to upload: build service unavailable" >&2
      exit 1
    fi
    echo '{"deploymentId":"abc12345-dead-beef"}'
    ;;
  deployment)
    echo '[{"id":"abc12345-dead-beef","status":"SUCCESS","createdAt":"2999-01-01T00:00:00Z"}]'
    ;;
esac
STUB
chmod +x "$WORK/home/.railway/bin/railway"

run_deploy() {
  HOME="$WORK/home" RAILWAY_TOKEN=test-token RAILWAY_POLL_INTERVAL_SECS=0 RAILWAY_MAX_POLLS=2 \
    bash "$ROOT/just/deploy.sh" api services/api/railway.json
}

expect() { # name, condition exit code, message
  if [[ "$2" == 0 ]]; then echo "ok   $1"; else echo "FAIL $1: $3"; failures=$((failures + 1)); fi
}

# The real page is not clean text (grep calls it a binary file), so the fixture holds a NUL byte too.
printf '<html>\0<h1>New builds are temporarily paused</h1> Major Outage</html>\n' >"$WORK/incident.html"
echo '<html><h1>All systems operational</h1></html>' >"$WORK/calm.html"

# 1. Upload fails during a Railway incident: exits 1, shows Railway's own error, names the incident.
out="$(STUB_MODE=upload-fails RAILWAY_STATUS_URL="file://$WORK/incident.html" run_deploy 2>&1)"; code=$?
expect "incident: exits non-zero" $((code == 1 ? 0 : 1)) "exit $code"
grep -q "build service unavailable" <<<"$out"; expect "incident: shows railway output" $? "$out"
grep -qi "platform incident" <<<"$out"; expect "incident: names the platform incident" $? "$out"
grep -qi "new builds are temporarily paused" <<<"$out"; expect "incident: quotes the headline" $? "$out"

# 2. Upload fails while Railway is healthy: still shows the output, does not blame Railway.
out="$(STUB_MODE=upload-fails RAILWAY_STATUS_URL="file://$WORK/calm.html" run_deploy 2>&1)"; code=$?
expect "healthy: exits non-zero" $((code == 1 ? 0 : 1)) "exit $code"
grep -q "build service unavailable" <<<"$out"; expect "healthy: shows railway output" $? "$out"
! grep -qi "platform incident" <<<"$out"; expect "healthy: does not blame Railway" $? "$out"

# 3. Status page unreachable: the diagnosis degrades quietly and the failure is still reported.
out="$(STUB_MODE=upload-fails RAILWAY_STATUS_URL="file://$WORK/missing.html" run_deploy 2>&1)"; code=$?
expect "unreachable status: exits non-zero" $((code == 1 ? 0 : 1)) "exit $code"
grep -q "build service unavailable" <<<"$out"; expect "unreachable status: shows railway output" $? "$out"

# 4. Normal deploy: unchanged behaviour, reaches SUCCESS and exits 0.
out="$(RAILWAY_STATUS_URL="file://$WORK/incident.html" run_deploy 2>&1)"; code=$?
expect "success: exits zero" $((code == 0 ? 0 : 1)) "exit $code: $out"
grep -q "reached SUCCESS" <<<"$out"; expect "success: reports SUCCESS" $? "$out"
! grep -qi "incident" <<<"$out"; expect "success: no incident noise" $? "$out"

[[ ! -e "$ROOT/railway.json" ]]; expect "cleans up railway.json" $? "left behind"

(( failures == 0 )) && echo "all passed" || { echo "$failures failed"; exit 1; }
