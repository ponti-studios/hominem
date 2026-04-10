const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  ...expoPreset,
  setupFiles: ['./tests/setup/base.js'],
  setupFilesAfterEnv: ['./tests/setup/render.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/utils/**/*.test.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@shopify/react-native-skia|@shopify/restyle|@shopify/flash-list|@tanstack/react-query|@hominem/.*|better-auth|@better-auth/.*|posthog-react-native|msw|@mswjs/.*|until-async)',
  ],
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
    '^@hominem/env$': path.join(rootDir, 'packages/core/env/src/index.ts'),
    '^@hominem/env/(.*)$': path.join(rootDir, 'packages/core/env/src/$1.ts'),
    '^msw$': '<rootDir>/node_modules/msw',
    '^msw/(.*)$': '<rootDir>/node_modules/msw/$1',
  },
  slowTestThreshold: 5,
};
