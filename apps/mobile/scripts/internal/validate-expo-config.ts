#!/usr/bin/env bun
import assert from 'assert';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

function main(): number {
  const expoConfigPath = resolve(process.cwd(), 'config/expo-config.js');
  const expoConfig = require(expoConfigPath);
  const { EXPO_OWNER, EXPO_PROJECT_ID, EXPO_PROJECT_SLUG } = expoConfig;

  const result = spawnSync('bunx', ['--yes', 'expo', 'config', '--json', '--type', 'public'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    if (stdout.trim().length > 0) {
      console.error(stdout);
    }
    if (stderr.trim().length > 0) {
      console.error(stderr);
    }
    console.error('Failed to resolve Expo public config');
    return exitCode;
  }

  if (stderr.trim().length > 0) {
    console.error(stderr);
  }

  const config = JSON.parse(stdout);

  const resolvedConfig = {
    owner: config.owner,
    projectId: config.extra?.eas?.projectId,
    slug: config.slug,
  };
  const expectedConfig = {
    owner: EXPO_OWNER,
    projectId: EXPO_PROJECT_ID,
    slug: EXPO_PROJECT_SLUG,
  };

  assert.deepStrictEqual(
    resolvedConfig,
    expectedConfig,
    `Expo config mismatch: expected ${JSON.stringify(expectedConfig)}, got ${JSON.stringify(resolvedConfig)}`,
  );

  assert.ok(
    config.extra?.mobilePasskeyEnabled !== undefined,
    'Expo config mismatch: extra.mobilePasskeyEnabled must be present',
  );

  console.log('Expo config');
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(error);
  process.exit(1);
}
