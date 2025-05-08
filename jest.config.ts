import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/components/(.*)$/': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$/': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$/': '<rootDir>/src/hooks/$1',
    '^@/types/(.*)$/': '<rootDir>/src/types/$1',
    '^@/nodes/(.*)$/': '<rootDir>/src/nodes/$1',
    '^@/config/(.*)$/': '<rootDir>/src/config/$1',
    '^@/agents/(.*)$/': '<rootDir>/agents/$1',
    // Add mapping for agentdock-core internal logger
    '^agentdock-core/src/logging$': '<rootDir>/agentdock-core/src/logging/index.ts',
  },
  modulePathIgnorePatterns: ["<rootDir>/agentdock-core/node_modules/", "<rootDir>/agentdock-core/dist/"],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest', // For TypeScript
    '^.+\\.(js|jsx)$': 'ts-jest', // Transform JavaScript files with ts-jest
  },
  transformIgnorePatterns: [
    '/node_modules/(?!node-fetch)', // Allow node-fetch to be transformed
  ],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/agentdock-core/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config); 