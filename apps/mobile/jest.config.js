const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const bunDir = path.join(rootDir, 'node_modules', '.bun');
const expoPreset = require('jest-expo/jest-preset');

function resolveBunPackageRoot(packageName) {
  const prefix = `${packageName.replace('/', '+')}@`;
  const entry = fs.readdirSync(bunDir).find((name) => name.startsWith(prefix));
  if (!entry) {
    throw new Error(`Unable to resolve ${packageName} from ${bunDir}`);
  }
  return path.join(bunDir, entry, 'node_modules', ...packageName.split('/'));
}

const babelRuntimeDir = resolveBunPackageRoot('@babel/runtime');

/** @type {import('jest').Config} */
module.exports = {
  ...expoPreset,
  setupFiles: ['./tests/setup/base.js'],
  setupFilesAfterEnv: ['./tests/setup/render.js'],
  testMatch: [
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/utils/**/*.test.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!\\.bun/.*/)(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@shopify/react-native-skia|@shopify/restyle|@shopify/flash-list|@tanstack/react-query|@hominem/.*|better-auth|@better-auth/.*|posthog-react-native|msw|@mswjs/.*|until-async)',
  ],
  moduleDirectories: ['node_modules', path.join(rootDir, 'node_modules')],
  moduleNameMapper: {
    '^@babel/runtime/(.*)$': path.join(babelRuntimeDir, '$1'),
    '^~/(.*)$': '<rootDir>/$1',
    '^@hominem/env$': path.join(rootDir, 'packages/core/env/src/index.ts'),
    '^@hominem/env/(.*)$': path.join(rootDir, 'packages/core/env/src/$1.ts'),
  },
  slowTestThreshold: 5,
};
