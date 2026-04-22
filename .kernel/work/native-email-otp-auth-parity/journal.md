# Journal

- 2026-04-18T06:24:23Z: Created work item `native-email-otp-auth-parity`.

## 2026-04-18 — Implementation complete

**New files:**
- `Hakumi/Services/Auth/AuthService.swift` — `enum AuthService` with `sendOTP`, `verifyOTP`, `resendOTP`, and input validation helpers. Calls better-auth endpoints via `URLSession.shared`.
- `Hakumi/Services/Auth/AuthCopy.swift` — Copy constants sourced verbatim from `packages/platform/auth/src/shared/ux-contract.ts`.
- `Hakumi/Screens/Auth/AuthLayout.swift` — Shared auth screen layout (title, helper, form area).
- `Hakumi/Screens/Auth/AuthSignInView.swift` — Real `AuthSignInScreen`: email field, validation, OTP send, push to verify screen.
- `Hakumi/Screens/Auth/VerifyOTPView.swift` — Real `VerifyOTPScreen`: OTP input, verify, resend, change-email back nav.

**Modified:**
- `project.yml` — `API_BASE_URL` per-config build setting, `APIBaseURL` Info.plist key, ATS localhost exception.
- `PlaceholderScreen.swift` — Removed auth screen placeholder stubs.
- `Observability.swift` — Stubbed PostHog calls to no-ops (SPM package not configured yet).

**Build:** `xcodebuild build -scheme "Hakumi Dev"` exits 0.

**Follow-up:** session persistence → `native-session-storage-and-auth-provider`; passkeys → `native-passkey-sign-in-parity`.
