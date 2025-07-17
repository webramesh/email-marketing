/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
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
    '!src/**/*.d.ts',
    '!src/generated/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
};

module.exports = config;