# CLAUDE.md — apps/omiro

Expo managed workflow, iOS-only. No Android platform checks or fallbacks.

## Navigation

Uses Expo Router (file-based). Route files live in `app/`. The `~` alias maps to the project root (configured in tsconfig/babel).

- `app/(auth)/` — unauthenticated screens
- `app/(protected)/` — requires auth; `resolveAuthRedirect` in `_layout.tsx` guards this group
- Auth redirect logic lives in `services/navigation/auth-route-guard.ts`

## Component conventions

Root providers (order matters): `GestureHandlerRootView` → `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` → `AuthProvider` → `PostHogProvider`. Do not add new root providers without checking this chain.

Use `makeStyles` + `theme` from `~/components/theme` for styling — not raw `StyleSheet.create` with hardcoded values.

## Maestro UI tests

Always select by `testID` (`id:` in YAML), never by text. iOS accessibility tree merging silently misses modals when targeting by text.

Key testIDs:
- `feed-composer`, `feed-composer-input`
- `chat-composer`, `chat-composer-input`

Run tests:
```bash
just mobile-test
```

Maestro requires Java 17:
```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
```

## Commands

```bash
just run-ios dev          # launch on iOS simulator
just mobile-lint          # lint
just mobile-prebuild      # expo prebuild (before native changes)
```
