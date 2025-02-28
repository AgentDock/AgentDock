import { NodeRegistry } from '../node-registry';
import { BaseNode, NodeMetadata, NodePort } from '../base-node';
import { createError, ErrorCode } from '../../errors';

abstract class MockNode extends BaseNode {
  protected getCategory(): 'core' | 'custom' {
    return 'core';
  }

  protected getLabel(): string {
    return 'Mock Node';
  }

  protected getDescription(): string {
    return 'Mock node for testing';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): NodeMetadata['compatibility'] {
    return {
      core: true,
      pro: false,
      custom: false
    };
  }

  protected getInputs(): readonly NodePort[] {
    return [];
  }

  protected getOutputs(): readonly NodePort[] {
    return [];
  }
  
  static getNodeMetadata(): NodeMetadata {
    return {
      category: 'core',
      label: 'Mock Node',
      description: 'Mock node for testing',
      inputs: [],
      outputs: [],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: false,
        custom: false
      }
    };
  }

  async execute(input: unknown): Promise<unknown> {
    return input;
  }

  async cleanup(): Promise<void> {}
}

class MockCoreNode extends MockNode {
  readonly type = 'mockCore';
}

class MockCustomNode extends MockNode {
  readonly type = 'mockCustom';

  protected getCategory(): 'core' | 'custom' {
    return 'custom';
  }

  static getNodeMetadata(): NodeMetadata {
    return {
      category: 'custom',
      label: 'Mock Custom Node',
      description: 'Mock custom node for testing',
      inputs: [],
      outputs: [],
      version: '1.0.0',
      compatibility: {
        core: false,
        pro: false,
        custom: true
      }
    };
  }

  protected getLabel(): string {
    return 'Mock Custom Node';
  }

  protected getDescription(): string {
    return 'Mock custom node for testing';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): NodeMetadata['compatibility'] {
    return {
      core: false,
      pro: false,
      custom: true
    };
  }
}

// Test suite for NodeRegistry
describe('NodeRegistry', () => {
  beforeEach(() => {
    NodeRegistry.clear();
  });

  it('should register a core node', () => {
    NodeRegistry.register('mockCoreNode', MockCoreNode, '1.0.0');
    expect(NodeRegistry.has('mockCoreNode')).toBe(true);
  });

  it('should register a custom node', () => {
    NodeRegistry.registerCustomNode('mockCustomNode', MockCustomNode, '1.0.0');
    expect(NodeRegistry.has('mockCustomNode')).toBe(true);
  });

  it('should throw an error if node category does not match', () => {
    expect(() => {
      NodeRegistry.register('mockCustomNode', MockCustomNode, '1.0.0');
    }).toThrow(createError('node', 'Only core nodes can be registered with register()', ErrorCode.NODE_VALIDATION));
  });
});
