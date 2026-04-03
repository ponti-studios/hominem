Mobile testing guidelines:

- Put pure logic and state transitions in `tests/` and `tests/components/*.test.ts`.
- Put React rendering and provider behavior in `tests/routes/`, `tests/screens/`, and `tests/components/*.test.tsx`.
- Put cross-module contracts, cache rules, and navigation/data invariants in `tests/contracts/`.
- Keep render tests shallow. If a screen pulls in camera, media, font, or device APIs, extract the logic and test that instead of mocking the whole Expo stack.
- Reserve native-boundary confidence for Detox and end-to-end flows.
- Centralize native mocks in `tests/__mocks__/`.
- Use `tests/setup/base.js` for non-React globals and `tests/setup/render.js` for the shared render lane setup.
- Prefer `tests/support/render.tsx` for screen/component rendering, event helpers, and shared cleanup behavior.
- Prefer `tests/support/router.ts` for pathname, params, and router spy control instead of redefining `expo-router` mocks in each file.
- Keep file-local `jest.mock(...)` usage for screen-specific services or hook contracts only. Theme, router, safe-area, and common native shims should stay shared.
- Lane commands:
- `bun run test:logic`
- `bun run test:render`
- `bun run test:contracts`
- `bun run test:file tests/screens/auth-screens.test.tsx`
