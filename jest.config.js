/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next-auth$': '<rootDir>/src/__mocks__/next-auth.ts',
    '^next-auth/(.*)$': '<rootDir>/src/__mocks__/next-auth.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(next-auth|@auth/core)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/generated/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
};

module.exports = config;