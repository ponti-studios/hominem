#!/usr/bin/env node
// Dev entry point: runs the server under tsx watch, and in the same
// process keeps the hosted-login page's client bundles rebuilt
// (public/login.js from browser.ts, public/settings.js from settings.ts,
// public/settings-ai.js from settings-ai.ts) plus the CSS modules compiled
// to public/login.css + styles.generated.ts. Those are committed build
// artifacts that tsx watch has no reason to know about, so without this
// they silently drift from their sources during local dev.
import { spawn } from 'node:child_process';
import { watch as watchDir } from 'node:fs';
import { join } from 'node:path';

import { watch } from 'rolldown';

import {
  loginClientBuildOptions,
  settingsAiClientBuildOptions,
  settingsAiFootprintClientBuildOptions,
  settingsClientBuildOptions,
} from './login-client-bundle.mjs';
import { buildLoginStyles } from './login-styles.mjs';

// Resolve tsx from this package's own node_modules/.bin rather than relying
// on PATH, so this works the same whether it's invoked through a pnpm
// script (PATH already has node_modules/.bin) or run directly.
const tsxBin = new URL('../node_modules/.bin/tsx', import.meta.url).pathname;

const server = spawn(tsxBin, ['watch', '--tsconfig', 'tsconfig.dev.json', 'src/index.ts'], {
  stdio: 'inherit',
  env: process.env,
});

// Same deal for the login page's stylesheet: tsx has no CSS awareness, so
// keep public/login.css + styles.generated.ts rebuilt from the component
// CSS modules while developing.
const componentsDir = join(process.cwd(), 'src', 'routes', 'login', 'components');
let stylesTimer;
const rebuildLoginStyles = async () => {
  const start = performance.now();
  try {
    const { cssBytes } = await buildLoginStyles();
    console.log(
      `[login.css] rebuilt (${cssBytes} bytes) in ${Math.round(performance.now() - start)}ms`,
    );
  } catch (error) {
    console.error('[login.css] build failed:', error);
  }
};
await rebuildLoginStyles();
watchDir(componentsDir, { recursive: true }, (_event, filename) => {
  if (!filename?.endsWith('.css')) return;
  clearTimeout(stylesTimer);
  stylesTimer = setTimeout(rebuildLoginStyles, 80);
});

const clientWatcher = watch(loginClientBuildOptions);
clientWatcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    console.log(`[login.js] rebuilt in ${event.duration}ms`);
  } else if (event.code === 'ERROR') {
    console.error('[login.js] build failed:', event.error);
  }
});

const settingsWatcher = watch(settingsClientBuildOptions);
settingsWatcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    console.log(`[settings.js] rebuilt in ${event.duration}ms`);
  } else if (event.code === 'ERROR') {
    console.error('[settings.js] build failed:', event.error);
  }
});

const settingsAiWatcher = watch(settingsAiClientBuildOptions);
settingsAiWatcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    console.log(`[settings-ai.js] rebuilt in ${event.duration}ms`);
  } else if (event.code === 'ERROR') {
    console.error('[settings-ai.js] build failed:', event.error);
  }
});

const settingsAiFootprintWatcher = watch(settingsAiFootprintClientBuildOptions);
settingsAiFootprintWatcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    console.log(`[settings-ai-footprint.js] rebuilt in ${event.duration}ms`);
  } else if (event.code === 'ERROR') {
    console.error('[settings-ai-footprint.js] build failed:', event.error);
  }
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clientWatcher.close();
  settingsWatcher.close();
  settingsAiWatcher.close();
  settingsAiFootprintWatcher.close();
  server.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('exit', (code) => {
  clientWatcher.close();
  settingsWatcher.close();
  settingsAiWatcher.close();
  settingsAiFootprintWatcher.close();
  process.exit(code ?? 0);
});
