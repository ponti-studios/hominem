const path = require('path')

const rootDir = path.resolve(__dirname, '../..')

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: ['./tests/setup/base.js'],
  testMatch: [
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/utils/**/*.test.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!\\.bun/.*/)(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@shopify/react-native-skia|@shopify/restyle|@shopify/flash-list|@tanstack/react-query|@hominem/.*|better-auth|@better-auth/.*|posthog-react-native)',
  ],
  moduleDirectories: ['node_modules', path.join(rootDir, 'node_modules')],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
    '^@hominem/env/brand$': path.join(rootDir, 'packages/core/env/src/brand.ts'),
    '^@hominem/env$': path.join(rootDir, 'packages/core/env/src/index.ts'),
  },
  slowTestThreshold: 5,
}
