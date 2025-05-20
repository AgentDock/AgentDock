import '@testing-library/jest-dom';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { TextEncoder, TextDecoder } from 'util';
import fetch, { Request, Response } from 'node-fetch';

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
const originalConsoleGroupCollapsed = console.groupCollapsed;
const originalConsoleGroupEnd = console.groupEnd;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
  console.groupCollapsed = jest.fn();
  console.groupEnd = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
  console.groupCollapsed = originalConsoleGroupCollapsed;
  console.groupEnd = originalConsoleGroupEnd;
});

// Assign fetch to the global object
(global as any).fetch = fetch;

// Mock the Request and Response classes
(global as any).Request = Request;
(global as any).Response = Response;

// Polyfill other globals if needed
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Add Web Streams API polyfill for Node.js environment
global.TransformStream = TransformStream as any;
global.ReadableStream = ReadableStream as any;
global.WritableStream = WritableStream as any;

// Mock ResizeObserver globally (optional, but often helpful for UI tests)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock the custom logger module MORE aggressively
jest.mock('agentdock-core/src/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(), // Ensure child() returns the mock itself for chaining
  },
  // Re-export actual values for other things exported from the module if needed
  // e.g., if LogCategory is also exported and needed by tests:
  LogCategory: jest.requireActual('agentdock-core/src/logging').LogCategory,
}));
