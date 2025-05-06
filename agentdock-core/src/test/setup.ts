/**
 * @fileoverview Test setup and utilities for agentdock-core
 */

import { CoreLLM } from '../llm/core-llm';
import { LLMConfig } from '../llm/types';
import { LLMOrchestrationService } from '../llm/llm-orchestration-service';
import { OrchestrationManager } from '../orchestration';
import { SessionId } from '../types/session';
import { BaseNode, NodeMetadata, NodePort } from '../nodes/base-node';
import { NodeCategory } from '../types/node-category';
import { StorageProvider } from '../storage/types';

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn()
  },
  getRandomValues: jest.fn()
};

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

// Mock Response
class MockResponse {
  constructor(
    public body: any,
    public init?: ResponseInit
  ) {}

  headers = new Headers(this.init?.headers);
  status = this.init?.status || 200;
  ok = this.status >= 200 && this.status < 300;

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }

  text() {
    return Promise.resolve(this.body);
  }
}

// Setup global mocks
beforeAll(() => {
  // Setup Web Crypto API mock
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
  });

  // Setup localStorage mock
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });

  // Setup Response mock
  Object.defineProperty(global, 'Response', {
    value: MockResponse,
    writable: true
  });

  // Setup TextEncoder/TextDecoder
  Object.defineProperty(global, 'TextEncoder', {
    value: class {
      encode(str: string) {
        return new Uint8Array([...str].map(c => c.charCodeAt(0)));
      }
    },
    writable: true
  });

  Object.defineProperty(global, 'TextDecoder', {
    value: class {
      decode(arr: Uint8Array) {
        return String.fromCharCode(...arr);
      }
    },
    writable: true
  });
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockLocalStorage.length = 0;
});

// Export mocks for direct use in tests
export {
  mockCrypto,
  mockLocalStorage,
  MockResponse
};

// Export test utilities
export function createMockStream(chunks: string[], options?: { delay?: number }) {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (options?.delay) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
} 

/**
 * LLM Mocking Utilities
 * 
 * These functions create standardized mock objects for LLM-related components,
 * ensuring consistent behavior across tests.
 */

/**
 * Creates a mock CoreLLM instance with pre-configured responses
 * 
 * @param options Configuration options for the mock
 * @returns A mocked CoreLLM instance
 */
export function createMockCoreLLM(options: {
  provider?: string;
  modelId?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  streamText?: jest.Mock;
  generateText?: jest.Mock;
} = {}): jest.Mocked<CoreLLM> {
  const defaultProvider = 'openai';
  const defaultModelId = 'gpt-3.5-turbo';

  const mockLLM = {
    getProvider: jest.fn().mockReturnValue(options.provider || defaultProvider),
    getModelId: jest.fn().mockReturnValue(options.modelId || defaultModelId),
    getModel: jest.fn().mockReturnValue({
      provider: options.provider || defaultProvider,
      modelId: options.modelId || defaultModelId
    }),
    getLastTokenUsage: jest.fn().mockReturnValue(options.tokenUsage || null),
    streamText: options.streamText || jest.fn().mockImplementation(async (opts) => {
      if (opts?.onFinish) {
        await opts.onFinish({
          finishReason: 'stop',
          usage: {
            promptTokens: options.tokenUsage?.promptTokens || 100,
            completionTokens: options.tokenUsage?.completionTokens || 50,
            totalTokens: options.tokenUsage?.totalTokens || 150
          },
          response: { messages: [] }
        });
      }
      return {
        usage: Promise.resolve({
          promptTokens: options.tokenUsage?.promptTokens || 100,
          completionTokens: options.tokenUsage?.completionTokens || 50,
          totalTokens: options.tokenUsage?.totalTokens || 150
        }),
        response: Promise.resolve({
          provider: options.provider || defaultProvider,
          id: 'mock-id',
          timestamp: new Date(),
          modelId: options.modelId || defaultModelId,
          messages: []
        }),
        finishReason: Promise.resolve('stop'),
        text: Promise.resolve(''),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([]),
      };
    }),
    generateText: options.generateText || jest.fn().mockResolvedValue({
      text: '',
      usage: {
        promptTokens: options.tokenUsage?.promptTokens || 100,
        completionTokens: options.tokenUsage?.completionTokens || 50,
        totalTokens: options.tokenUsage?.totalTokens || 150
      }
    }),
    generateObject: jest.fn().mockResolvedValue({
      object: {},
      usage: {
        promptTokens: options.tokenUsage?.promptTokens || 100,
        completionTokens: options.tokenUsage?.completionTokens || 50,
        totalTokens: options.tokenUsage?.totalTokens || 150
      }
    }),
    streamObject: jest.fn().mockResolvedValue({
      object: Promise.resolve({}),
      usage: Promise.resolve({
        promptTokens: options.tokenUsage?.promptTokens || 100,
        completionTokens: options.tokenUsage?.completionTokens || 50,
        totalTokens: options.tokenUsage?.totalTokens || 150
      })
    })
  } as unknown as jest.Mocked<CoreLLM>;

  return mockLLM;
}

/**
 * Creates a mock LLMOrchestrationService instance
 * 
 * @param options Configuration options for the mock
 * @returns A mocked LLMOrchestrationService instance
 */
export function createMockLLMOrchestrationService(options: {
  coreLLM?: jest.Mocked<CoreLLM>;
  orchestrationManager?: jest.Mocked<OrchestrationManager>;
  sessionId?: SessionId;
  streamWithOrchestration?: jest.Mock;
} = {}): jest.Mocked<LLMOrchestrationService> {
  const mockCoreLLM = options.coreLLM || createMockCoreLLM();
  
  const mockService = {
    streamWithOrchestration: options.streamWithOrchestration || jest.fn().mockImplementation(async () => {
      return {
        usage: Promise.resolve({
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }),
        response: Promise.resolve({
          provider: mockCoreLLM.getProvider(),
          id: 'mock-id',
          timestamp: new Date(),
          modelId: mockCoreLLM.getModelId(),
          messages: []
        }),
        finishReason: Promise.resolve('stop'),
        text: Promise.resolve(''),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([]),
      };
    })
  } as unknown as jest.Mocked<LLMOrchestrationService>;

  return mockService;
}

/**
 * Creates a mock OrchestrationManager instance with pre-configured responses
 * 
 * @param options Configuration options for the mock
 * @returns A mocked OrchestrationManager instance
 */
export function createMockOrchestrationManager(options: {
  getState?: jest.Mock;
  setState?: jest.Mock;
  updateState?: jest.Mock;
  clearState?: jest.Mock;
  ensureStateExists?: jest.Mock;
  stateManager?: {
    get?: jest.Mock;
    set?: jest.Mock;
    update?: jest.Mock;
    delete?: jest.Mock;
  };
  sequencer?: {
    getStepId?: jest.Mock;
  };
  getActiveStep?: jest.Mock;
  checkCondition?: jest.Mock;
  registerTools?: jest.Mock;
  switchFlow?: jest.Mock;
  switchStep?: jest.Mock;
  startOrchestration?: jest.Mock;
  stopOrchestration?: jest.Mock;
} = {}): jest.Mocked<OrchestrationManager> {
  const mockManager = {
    getState: options.getState || jest.fn().mockResolvedValue({ 
      cumulativeTokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, 
      recentlyUsedTools: [] 
    }),
    setState: options.setState || jest.fn().mockResolvedValue({}),
    updateState: options.updateState || jest.fn().mockResolvedValue({}),
    clearState: options.clearState || jest.fn().mockResolvedValue({}),
    ensureStateExists: options.ensureStateExists || jest.fn().mockResolvedValue({}),
    stateManager: {
      get: options.stateManager?.get || jest.fn(),
      set: options.stateManager?.set || jest.fn(),
      update: options.stateManager?.update || jest.fn(),
      delete: options.stateManager?.delete || jest.fn()
    },
    sequencer: {
      getStepId: options.sequencer?.getStepId || jest.fn()
    },
    getActiveStep: options.getActiveStep || jest.fn(),
    checkCondition: options.checkCondition || jest.fn(),
    registerTools: options.registerTools || jest.fn(),
    switchFlow: options.switchFlow || jest.fn(),
    switchStep: options.switchStep || jest.fn(),
    startOrchestration: options.startOrchestration || jest.fn(),
    stopOrchestration: options.stopOrchestration || jest.fn(),
  } as unknown as jest.Mocked<OrchestrationManager>;

  return mockManager;
}

/**
 * Creates a mock StorageProvider instance with pre-configured responses
 * 
 * @param options Configuration options for the mock
 * @returns A mocked StorageProvider instance
 */
export function createMockStorageProvider(options: {
  get?: jest.Mock;
  set?: jest.Mock;
  delete?: jest.Mock;
  exists?: jest.Mock;
  getMany?: jest.Mock;
  setMany?: jest.Mock;
  deleteMany?: jest.Mock;
  list?: jest.Mock;
  clear?: jest.Mock;
  getList?: jest.Mock;
  saveList?: jest.Mock;
  deleteList?: jest.Mock;
  destroy?: jest.Mock;
} = {}): jest.Mocked<StorageProvider> {
  return {
    get: options.get || jest.fn(),
    set: options.set || jest.fn(),
    delete: options.delete || jest.fn(),
    exists: options.exists || jest.fn(),
    getMany: options.getMany || jest.fn(),
    setMany: options.setMany || jest.fn(),
    deleteMany: options.deleteMany || jest.fn(),
    list: options.list || jest.fn(),
    clear: options.clear || jest.fn(),
    getList: options.getList || jest.fn(),
    saveList: options.saveList || jest.fn(),
    deleteList: options.deleteList || jest.fn(),
    destroy: options.destroy || jest.fn(),
  };
}

/**
 * Creates a mock BaseNode instance with pre-configured responses
 * 
 * @param options Configuration options for the mock
 * @returns A mocked BaseNode instance
 */
export function createMockBaseNode(options: {
  type?: string;
  category?: NodeCategory;
  label?: string;
  description?: string;
  version?: string;
  compatibility?: NodeMetadata['compatibility'];
  inputs?: readonly NodePort[];
  outputs?: readonly NodePort[];
  execute?: jest.Mock;
  cleanup?: jest.Mock;
} = {}): jest.Mocked<BaseNode> {
  const mockNode = {
    type: options.type || 'mock-node',
    getCategory: jest.fn().mockReturnValue(options.category || NodeCategory.CORE),
    getLabel: jest.fn().mockReturnValue(options.label || 'Mock Node'),
    getDescription: jest.fn().mockReturnValue(options.description || 'Mock node for testing'),
    getVersion: jest.fn().mockReturnValue(options.version || '1.0.0'),
    getCompatibility: jest.fn().mockReturnValue(options.compatibility || {
      core: true,
      pro: false,
      custom: false
    }),
    getInputs: jest.fn().mockReturnValue(options.inputs || []),
    getOutputs: jest.fn().mockReturnValue(options.outputs || []),
    getMetadata: jest.fn().mockReturnValue({
      category: options.category || NodeCategory.CORE,
      label: options.label || 'Mock Node',
      description: options.description || 'Mock node for testing',
      version: options.version || '1.0.0',
      inputs: options.inputs || [],
      outputs: options.outputs || [],
      compatibility: options.compatibility || {
        core: true,
        pro: false,
        custom: false
      },
    }),
    execute: options.execute || jest.fn().mockImplementation(input => Promise.resolve(input)),
    cleanup: options.cleanup || jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BaseNode>;

  return mockNode;
}   