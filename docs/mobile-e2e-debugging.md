# Mobile E2E Debugging

Use this when Detox boots the app but the JS runtime looks stale or crashes before the auth flow starts.

## Current suspicion

Detox is launching the E2E app from `apps/mobile/ios/build/Build/Products/Release-iphonesimulator/HakumiE2E.app`, but the generated `main.jsbundle` may not match current source edits.

## Fast checks

Run these from `apps/mobile`.

```bash
rm -rf ios/build
APP_VARIANT=e2e \
CI=1 \
EXPO_PUBLIC_APP_VARIANT=e2e \
EXPO_PUBLIC_POSTHOG_API_KEY="" \
EXPO_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com" \
EXPO_PUBLIC_API_BASE_URL="http://localhost:4040" \
EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED="false" \
pnpm exec expo prebuild --platform ios --clean

xcodebuild \
  -workspace ios/HakumiE2E.xcworkspace \
  -scheme HakumiE2E \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath ios/build

pnpm exec detox test e2e/smoke.mobile.e2e.js --configuration ios --cleanup --headless --record-logs all
```

## What to inspect

### 1. Confirm the bundle is fresh

```bash
strings ios/build/Build/Products/Release-iphonesimulator/main.jsbundle | rg 'posthog|apiKey|disabled|POSTHOG'
```

If you still see old PostHog initialization code, the build is stale and Detox is not using the current JS source.

### 2. Confirm the build args match Detox config

Check `apps/mobile/.detoxrc.json`:

- `APP_VARIANT=e2e`
- `EXPO_PUBLIC_APP_VARIANT=e2e`
- `EXPO_PUBLIC_POSTHOG_API_KEY=""`
- `rm -rf ios/build`
- `pnpm exec expo prebuild --platform ios --clean`
- `xcodebuild ... -derivedDataPath ios/build`

### 3. Compare source edits against bundle output

Search the current source for the code paths you expect to be disabled:

```bash
rg -n 'PostHogProvider|posthog-react-native|POSTHOG_ENABLED|use-screen-capture|review-prompt|boot sequence' apps/mobile
```

Then compare against the generated bundle:

```bash
strings ios/build/Build/Products/Release-iphonesimulator/main.jsbundle | rg 'PostHogProvider|posthog-react-native|POSTHOG_ENABLED'
```

## If Detox still crashes

1. Re-run the test with fresh artifacts:

```bash
pnpm exec detox test e2e/smoke.mobile.e2e.js --configuration ios --cleanup --record-logs all
```

2. Capture the simulator logs from the Detox output. The command usually looks like:

```bash
xcrun simctl spawn <simulator-id> log stream --level debug --style compact --predicate 'process == "HakumiE2E"'
```

3. If the app starts but fails during auth, inspect the startup log in `apps/mobile/artifacts/.../*.startup.log` for the first JS/native exception.

## Expected outcome

When the issue is fixed, the rebuilt bundle should reflect the current source, Detox should launch `HakumiE2E.app`, and the smoke test should advance past app startup without the stale PostHog crash.
