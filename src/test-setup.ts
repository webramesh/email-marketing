// Jest setup file for React component tests
import '@testing-library/jest-dom';

// Set test environment variables
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/email_marketing_test';

// Global test timeout
jest.setTimeout(30000);

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};