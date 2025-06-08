/**
 * @fileoverview Tests for the error handling system
 */

import fetch, { Request, Response } from 'node-fetch';

import { MockResponse } from '../../test/setup';
import { AgentError, createError, ErrorCode } from '../index';

// Assign fetch to the global object with the correct type
(global as any).fetch = fetch;

// Mock the Request and Response classes
(global as any).Request = Request;
(global as any).Response = Response;

describe('Error Handling System', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AgentError', () => {
    it('should create a basic error with required fields', () => {
      const error = new AgentError('Test error', ErrorCode.UNKNOWN);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.details).toEqual({});
      expect(error.httpStatus).toBe(500);
      expect(error.name).toBe('AgentError');
    });

    it('should include details when provided', () => {
      const details = { foo: 'bar' };
      const error = new AgentError('Test error', ErrorCode.UNKNOWN, details);
      expect(error.details).toEqual(details);
    });

    it('should use custom HTTP status when provided', () => {
      const error = new AgentError('Test error', ErrorCode.UNKNOWN, {}, 400);
      expect(error.httpStatus).toBe(400);
    });

    it('should convert to JSON correctly', () => {
      const error = new AgentError('Test error', ErrorCode.UNKNOWN, {
        foo: 'bar'
      });
      const json = error.toJSON();
      expect(json).toHaveProperty('name', 'AgentError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', ErrorCode.UNKNOWN);
      expect(json).toHaveProperty('details', { foo: 'bar' });
    });

    it('should include stack trace in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development' });

      const error = new AgentError('Test error', ErrorCode.UNKNOWN);
      const json = error.toJSON();
      expect(json.stack).toBeDefined();
    });

    it('should not include stack trace in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production' });

      const error = new AgentError('Test error', ErrorCode.UNKNOWN);
      const json = error.toJSON();
      expect(json.stack).toBeUndefined();
    });

    it('should create HTTP response with correct status and content type', () => {
      const error = new AgentError('Test error', ErrorCode.UNKNOWN, {}, 400);
      const response = error.toResponse();
      expect(response).toBeInstanceOf(MockResponse);
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('createError', () => {
    it.skip('should create error with default values', () => {
      const error = createError('generic', 'Test error', ErrorCode.UNKNOWN);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.details).toEqual({});
      expect(error.httpStatus).toBe(500);
    });

    it.skip('should create error with custom details', () => {
      const details = { foo: 'bar' };
      const error = createError(
        'generic',
        'Test error',
        ErrorCode.UNKNOWN,
        details
      );
      expect(error.details).toEqual(details);
    });

    it('should create error with custom HTTP status', () => {
      const error = createError(
        'generic',
        'Test error',
        ErrorCode.UNKNOWN,
        {},
        400
      );
      expect(error.httpStatus).toBe(400);
    });

    it('should handle all error types', () => {
      const types = [
        'node',
        'config',
        'llm',
        'api',
        'storage',
        'generic'
      ] as const;
      types.forEach((type) => {
        const error = createError(type, 'Test error', ErrorCode.UNKNOWN);
        expect(error).toBeInstanceOf(AgentError);
      });
    });
  });

  describe('Error Codes', () => {
    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCode);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it.skip('should have descriptive error codes', () => {
      Object.values(ErrorCode).forEach((code) => {
        expect(
          code.endsWith('_ERROR') ||
            code === 'NOT_IMPLEMENTED' ||
            code === 'TAMPERING_DETECTED' ||
            code === 'MAX_RETRIES_EXCEEDED' ||
            code === 'NODE_NOT_FOUND' ||
            code === 'CONFIG_NOT_FOUND'
        ).toBeTruthy();
        expect(code.length).toBeGreaterThan(6); // Ensure meaningful names
      });
    });

    it('should group error codes by category', () => {
      // Node errors
      expect(ErrorCode.NODE_INITIALIZATION).toBeDefined();
      expect(ErrorCode.NODE_EXECUTION).toBeDefined();
      expect(ErrorCode.NODE_CLEANUP).toBeDefined();

      // Configuration errors
      expect(ErrorCode.CONFIG_VALIDATION).toBeDefined();
      expect(ErrorCode.CONFIG_LOADING).toBeDefined();
      expect(ErrorCode.CONFIG_NOT_FOUND).toBeDefined();

      // Storage errors
      expect(ErrorCode.STORAGE_READ).toBeDefined();
      expect(ErrorCode.STORAGE_WRITE).toBeDefined();
      expect(ErrorCode.STORAGE_DELETE).toBeDefined();

      // Security errors
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.DECRYPTION_FAILED).toBeDefined();
      expect(ErrorCode.TAMPERING_DETECTED).toBeDefined();
      expect(ErrorCode.MAX_RETRIES_EXCEEDED).toBeDefined();
    });
  });
});
