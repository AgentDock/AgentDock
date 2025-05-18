import { NodeRegistry } from '../node-registry';
import { BaseNode, NodeMetadata, NodePort } from '../base-node';
import { ConcreteNodeConstructor } from '../node-registry';
import { createError, ErrorCode } from '../../errors';
import { NodeCategory } from '../../types/node-category';
import { createMockBaseNode } from '../../test/setup';

describe('NodeRegistry', () => {
  let mockCoreNodeClass: jest.Mock<BaseNode>;
  let mockCoreInstance: jest.Mocked<BaseNode>;
  let mockCoreMetadata: NodeMetadata;
  let mockCustomNodeClass: jest.Mock<BaseNode>;
  let mockCustomInstance: jest.Mocked<BaseNode>;
  let mockCustomMetadata: NodeMetadata;

  beforeEach(() => {
    NodeRegistry.clear();
    // Setup mock CORE node
    const coreNodeType = 'core-test-node';
    const coreNodeCategory = NodeCategory.CORE;
    // Define expected metadata values manually
    const coreMockParams = { type: coreNodeType, category: coreNodeCategory, version: '1.0.0' };
    mockCoreInstance = createMockBaseNode(coreMockParams);
    mockCoreNodeClass = jest.fn().mockImplementation(() => mockCoreInstance) as any;
    // Manually construct metadata object based on known parameters and expected BaseNode structure
    mockCoreMetadata = {
      category: coreNodeCategory,
      label: `${coreNodeType}-label`, // Assume a predictable label/desc based on helper/type
      description: `${coreNodeType}-description`,
      version: coreMockParams.version,
      inputs: [], // Assume empty for base mock, adjust if helper adds default ports
      outputs: [],
      compatibility: { core: true, pro: false, custom: false }, // Assume defaults for core
    };
    (mockCoreNodeClass as any).getNodeMetadata = jest.fn().mockReturnValue(mockCoreMetadata);

    // Setup mock CUSTOM node
    const customNodeType = 'custom-test-node';
    const customNodeCategory = NodeCategory.CUSTOM;
    const customMockParams = {
      type: customNodeType,
      category: customNodeCategory,
      version: '1.0.0',
    };
    mockCustomInstance = createMockBaseNode(customMockParams);
    mockCustomNodeClass = jest.fn().mockImplementation(() => mockCustomInstance) as any;
    mockCustomMetadata = {
      category: customNodeCategory,
      label: `${customNodeType}-label`,
      description: `${customNodeType}-description`,
      version: customMockParams.version,
      inputs: [],
      outputs: [],
      compatibility: { core: false, pro: false, custom: true }, // Assume defaults for custom
    };
    (mockCustomNodeClass as any).getNodeMetadata = jest.fn().mockReturnValue(mockCustomMetadata);
  });

  describe('register (for Core Nodes)', () => {
    it('should register a core node type successfully', () => {
      NodeRegistry.register(
        'core-test-node',
        mockCoreNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      expect(NodeRegistry.has('core-test-node')).toBe(true);
    });

    it('should throw error if registering a non-core node via register()', () => {
      expect(() => {
        NodeRegistry.register(
          'custom-test-node',
          mockCustomNodeClass as unknown as ConcreteNodeConstructor,
          '1.0.0',
        );
      }).toThrow(
        createError(
          'node',
          'Only core nodes can be registered with register()',
          ErrorCode.NODE_VALIDATION,
        ),
      );
    });

    it('should overwrite if registering a duplicate core node type', () => {
      const secondMockClass = jest
        .fn()
        .mockImplementation(() =>
          createMockBaseNode({ type: 'core-test-node', category: NodeCategory.CORE }),
        ) as any;
      (secondMockClass as any).getNodeMetadata = jest.fn().mockReturnValue(mockCoreMetadata);

      NodeRegistry.register(
        'core-test-node',
        mockCoreNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      NodeRegistry.register(
        'core-test-node',
        secondMockClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );

      expect(NodeRegistry.has('core-test-node')).toBe(true);
      NodeRegistry.create('core-test-node', 'test-id', {});
      expect(secondMockClass).toHaveBeenCalled();
      expect(mockCoreNodeClass).not.toHaveBeenCalled();
    });
  });

  describe('registerCustomNode', () => {
    it('should register a custom node type successfully', () => {
      NodeRegistry.registerCustomNode(
        'custom-test-node',
        mockCustomNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      expect(NodeRegistry.has('custom-test-node')).toBe(true);
    });

    it('should throw error if registering a core node via registerCustomNode()', () => {
      expect(() => {
        NodeRegistry.registerCustomNode(
          'core-test-node',
          mockCoreNodeClass as unknown as ConcreteNodeConstructor,
          '1.0.0',
        );
      }).toThrow(
        createError(
          'node',
          'Only custom nodes can be registered with registerCustomNode()',
          ErrorCode.NODE_VALIDATION,
        ),
      );
    });

    it('should overwrite if registering a duplicate custom node type', () => {
      const secondMockClass = jest
        .fn()
        .mockImplementation(() =>
          createMockBaseNode({ type: 'custom-test-node', category: NodeCategory.CUSTOM }),
        ) as any;
      (secondMockClass as any).getNodeMetadata = jest.fn().mockReturnValue(mockCustomMetadata);

      NodeRegistry.registerCustomNode(
        'custom-test-node',
        mockCustomNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      NodeRegistry.registerCustomNode(
        'custom-test-node',
        secondMockClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );

      expect(NodeRegistry.has('custom-test-node')).toBe(true);
      NodeRegistry.create('custom-test-node', 'test-id', {});
      expect(secondMockClass).toHaveBeenCalled();
      expect(mockCustomNodeClass).not.toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should return true if a core node type exists', () => {
      NodeRegistry.register(
        'core-test-node',
        mockCoreNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      expect(NodeRegistry.has('core-test-node')).toBe(true);
    });
    it('should return true if a custom node type exists', () => {
      NodeRegistry.registerCustomNode(
        'custom-test-node',
        mockCustomNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      expect(NodeRegistry.has('custom-test-node')).toBe(true);
    });
    it('should return false if the node type does not exist', () => {
      expect(NodeRegistry.has('non-existent-node')).toBe(false);
    });
  });

  describe('create', () => {
    it('should create an instance of a registered core node type with config', () => {
      NodeRegistry.register(
        'core-test-node',
        mockCoreNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      const config = { some: 'config' };
      const instance = NodeRegistry.create('core-test-node', 'instance-id-1', config);

      expect(instance).toBe(mockCoreInstance);
      expect(mockCoreNodeClass).toHaveBeenCalledWith('instance-id-1', config);
    });

    it('should create an instance of a registered custom node type with config', () => {
      NodeRegistry.registerCustomNode(
        'custom-test-node',
        mockCustomNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      const config = { other: 'setting' };
      const instance = NodeRegistry.create('custom-test-node', 'instance-id-2', config);

      expect(instance).toBe(mockCustomInstance);
      expect(mockCustomNodeClass).toHaveBeenCalledWith('instance-id-2', config);
    });

    it('should throw an error if trying to instantiate an unregistered node type', () => {
      expect(() => {
        NodeRegistry.create('unregistered-node', 'id', {});
      }).toThrow(
        createError('node', 'Unknown node type: unregistered-node', ErrorCode.NODE_NOT_FOUND),
      );
    });

    it('should throw an error if node constructor fails', () => {
      const erroringMockClass = jest.fn().mockImplementation(() => {
        throw new Error('Constructor failed');
      });
      // We need *some* metadata for registration validation, including version
      (erroringMockClass as any).getNodeMetadata = jest.fn().mockReturnValue({
        category: NodeCategory.CORE,
        version: '1.0.0', // Add the version here to match registration
      });
      NodeRegistry.register(
        'error-node',
        erroringMockClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );

      expect(() => {
        NodeRegistry.create('error-node', 'id', {});
      }).toThrow(new Error('Constructor failed')); // Expect the raw error from the mock constructor
    });
  });

  describe('getNodeMetadata', () => {
    it('should return empty arrays if no nodes are registered', () => {
      const metadata = NodeRegistry.getNodeMetadata();
      expect(metadata.nodes).toEqual([]);
      expect(metadata.customNodes).toEqual([]);
    });

    it('should return metadata for all registered core and custom nodes', () => {
      NodeRegistry.register(
        'core-test-node',
        mockCoreNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );
      NodeRegistry.registerCustomNode(
        'custom-test-node',
        mockCustomNodeClass as unknown as ConcreteNodeConstructor,
        '1.0.0',
      );

      const metadata = NodeRegistry.getNodeMetadata();

      expect(metadata.nodes).toHaveLength(1);
      expect(metadata.nodes[0].type).toBe('core-test-node');
      expect(metadata.nodes[0].version).toBe('1.0.0');
      expect(metadata.nodes[0].metadata).toEqual(mockCoreMetadata);

      expect(metadata.customNodes).toHaveLength(1);
      expect(metadata.customNodes[0].type).toBe('custom-test-node');
      expect(metadata.customNodes[0].version).toBe('1.0.0');
      expect(metadata.customNodes[0].metadata).toEqual(mockCustomMetadata);
    });
  });
});
