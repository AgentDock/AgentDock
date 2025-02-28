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
