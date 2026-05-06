/**
 * Jest configuration for pure-function unit tests.
 *
 * Scope: validators, deterministic profile, onboarding progress
 * helpers — anything that doesn't need React Native renderer or
 * native modules. Component tests would need jest-expo; we don't
 * need them yet.
 *
 * Native modules that load ESM at import time (expo-crypto,
 * expo-constants) are stubbed via __mocks__ so a module-level
 * import chain doesn't crash the test environment.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { isolatedModules: true },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.ts',
  },
  transformIgnorePatterns: ['/node_modules/'],
};
