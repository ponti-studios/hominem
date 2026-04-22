# Journal

- 2026-04-18T06:24:23Z: Created work item `native-boot-sequence-and-redirect-parity`.

## 2026-04-18 — Implementation complete

**`BootService.swift`** — `enum BootService` with:
- `run() async -> BootResult` — top-level boot: reads Keychain cookie, probes session, returns `.sessionLoaded(user:cookie:)` or `.sessionExpired`
- `probeSession(cookie:) async throws -> AuthUser?` — `GET /api/auth/session` with `Cookie` header; returns user if valid, nil on 401, throws on network error

Network failure during boot is treated as `.sessionExpired` (app stays usable; user can sign in manually). Matches Expo behavior where a failed boot probe dispatches `SESSION_RECOVERY_FAILED` and redirects to unauthenticated.

**`Router.bootstrap()`** — replaced placeholder delay with `runBootSequence()`:
- `.sessionLoaded` → `AuthProvider.shared.restoreSession(user:cookie:)` + `authPhase = .authenticated`
- `.sessionExpired` → `authPhase = .unauthenticated`

`StartupMetrics` marks preserved. `flushPendingRoute()` still fires after boot completes.

**Build:** `xcodebuild build -scheme "Hakumi Dev"` exits 0.
