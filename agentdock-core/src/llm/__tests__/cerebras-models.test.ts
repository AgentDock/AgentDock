import { validateCerebrasApiKey, fetchCerebrasModels } from '../providers/cerebras-adapter';
import { ModelService } from '../model-service';

describe('Cerebras Models', () => {
  const mockValidApiKey = 'csk-valid-key';
  const mockInvalidApiKey = 'invalid-key';

  beforeEach(() => {
    // Reset any mocked implementations
    jest.resetAllMocks();
    
    // Clear any registered models
    ModelService.clearModels();
  });

  describe('validateCerebrasApiKey', () => {
    it('should validate API key format', async () => {
      expect(await validateCerebrasApiKey(undefined)).toBe(false);
      expect(await validateCerebrasApiKey('')).toBe(false);
      expect(await validateCerebrasApiKey(mockInvalidApiKey)).toBe(false);
    });

    it('should accept both csk- and csk_ formats', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
      );

      const result1 = await validateCerebrasApiKey('csk-test-key');
      const result2 = await validateCerebrasApiKey('csk_test_key');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await validateCerebrasApiKey(mockValidApiKey);
      expect(result).toBe(false);
    });
  });

  describe('fetchCerebrasModels', () => {
    const mockModelsResponse = {
      object: 'list',
      data: [
        { id: 'llama3.1-8b' },
        { id: 'llama-3.3-70b' },
        { id: 'llama-4-scout-17b-16e-instruct' },
      ],
    };

    it('should fetch and register models successfully', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModelsResponse),
        })
      );

      const models = await fetchCerebrasModels(mockValidApiKey);
      
      expect(models).toHaveLength(3);
      expect(models[0].id).toBe('llama3.1-8b');
      expect(models[0].capabilities).toContain('text-generation');
      expect(models[0].contextWindow).toBe(8192);
    });

    it('should throw error for invalid API key', async () => {
      await expect(fetchCerebrasModels(undefined)).rejects.toThrow('API key is required');
    });

    it('should handle API errors', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      await expect(fetchCerebrasModels(mockValidApiKey)).rejects.toThrow('Failed to fetch models');
    });

    it('should handle invalid response data', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'data' }),
        })
      );

      await expect(fetchCerebrasModels(mockValidApiKey)).rejects.toThrow('Invalid model list');
    });
  });
});
