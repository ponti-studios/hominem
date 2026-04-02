Mobile testing guidelines:

- Put pure logic and state transitions in `tests/` and `tests/components/*.test.ts`.
- Put React rendering and provider behavior in `tests/routes/`, `tests/screens/`, and `tests/components/*.test.tsx`.
- Put cross-module contracts, cache rules, and navigation/data invariants in `tests/contracts/`.
- Keep render tests shallow. If a screen pulls in camera, media, font, or device APIs, extract the logic and test that instead of mocking the whole Expo stack.
- Reserve native-boundary confidence for Detox and end-to-end flows.
- Centralize native mocks in `tests/__mocks__/`.
- Use `tests/setup/base.ts` for non-React globals and `tests/setup/render.ts` only for the render lane.
