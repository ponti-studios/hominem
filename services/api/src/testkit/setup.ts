import { afterAll, beforeAll } from 'vitest';

import { installScriptedProviders } from './scripted-providers';

// Wires the single scripted-providers dispatcher up for every test file in
// this suite, so individual test files never need to manage their own
// install/teardown (and can't collide with each other's install by
// forgetting one). vitest.config.ts sets ENV=scripted for the whole run, so
// this always installs both providers here.
let stop: (() => void) | undefined;

beforeAll(() => {
  stop = installScriptedProviders({ ai: true, email: true });
});

afterAll(() => {
  stop?.();
});
