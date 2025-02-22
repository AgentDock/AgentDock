import '@testing-library/jest-dom';
import { ReadableStream } from 'stream/web';

// Polyfill globals needed for edge runtime testing
global.TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream as any;

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
process.env.ANTHROPIC_API_KEY = 'test-key';

// Mock console methods to keep test output clean
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Mock fetch for tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
); 