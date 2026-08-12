import { ModelRegistry } from '../model-registry';
import { ProviderRegistry } from '../provider-registry';
import {
  fetchAtlasCloudModels,
  validateAtlasCloudApiKey
} from '../providers/atlascloud-adapter';

const mockFetch = jest.fn();

describe('Atlas Cloud provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ModelRegistry.resetModels(['atlascloud']);
    global.fetch = mockFetch;
  });

  it('registers provider metadata and node mappings', () => {
    expect(ProviderRegistry.getProvider('atlascloud')).toMatchObject({
      displayName: 'Atlas Cloud',
      defaultModel: 'qwen/qwen3.8-max'
    });
    expect(ProviderRegistry.getProviderFromNodeType('llm.atlascloud')).toBe(
      'atlascloud'
    );
    expect(ProviderRegistry.getNodeTypeFromProvider('atlascloud')).toBe(
      'llm.atlascloud'
    );
  });

  it('validates a key through the model catalog endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    await expect(validateAtlasCloudApiKey('test-key')).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.atlascloud.ai/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    );
  });

  it('maps and registers discovered models', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'qwen/qwen3.8-max',
            name: 'Qwen 3.8 Max',
            context_length: 262144,
            max_output_length: 32768,
            output_modalities: ['text'],
            supported_features: ['tools']
          },
          {
            id: 'example/image-model',
            output_modalities: ['image']
          }
        ]
      })
    });

    await expect(fetchAtlasCloudModels('test-key')).resolves.toEqual([
      expect.objectContaining({
        id: 'qwen/qwen3.8-max',
        displayName: 'Qwen 3.8 Max',
        contextWindow: 262144,
        defaultMaxTokens: 32768,
        capabilities: ['text', 'tools']
      })
    ]);
  });

  it('rejects an invalid key response', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Unauthorized' });

    await expect(validateAtlasCloudApiKey('bad-key')).resolves.toBe(false);
  });
});
