import { BaseNode, NodeMetadata, NodePort } from '../base-node';
import { NodeCategory } from '../../types/node-category';

// Simple concrete implementation for testing BaseNode contract
class TestNode extends BaseNode<{ configParam: string }> {
  readonly type = 'test-node';
  static readonly VERSION = '0.1.0'; // Define version statically for consistency

  constructor(id: string, config: { configParam: string }) {
    super(id, config);
  }

  // --- Implement abstract methods for metadata ---
  protected getCategory(): NodeCategory {
    return NodeCategory.CORE; // Use an existing valid category
  }
  protected getLabel(): string {
    return 'Test Node Label';
  }
  protected getDescription(): string {
    return 'Test Node Description';
  }
  protected getVersion(): string {
    return TestNode.VERSION;
  }
  protected getCompatibility(): NodeMetadata['compatibility'] {
    return { core: true, pro: true, custom: true };
  }
  protected getInputs(): readonly NodePort[] {
    return [
      { id: 'input1', type: 'string', label: 'Input 1', required: true }, // Removed description
      { id: 'input2', type: 'number', label: 'Input 2', required: false },
    ];
  }
  protected getOutputs(): readonly NodePort[] {
    return [
      { id: 'output1', type: 'boolean', label: 'Output 1' }, // Removed description
    ];
  }

  // --- Implement abstract execution methods ---
  async execute(input: unknown): Promise<unknown> {
    // Simple echo logic for testing
    return { received: input }; // Removed protected config access
  }
  async cleanup(): Promise<void> {
    // No cleanup needed for this simple node
  }
}

describe('BaseNode Contract Validation (via TestNode)', () => {
  let testNode: TestNode;
  const nodeId = 'test-instance-1';
  const nodeConfig = { configParam: 'test-value' };

  beforeEach(() => {
    testNode = new TestNode(nodeId, nodeConfig);
  });

  it('should have correct id and config', () => {
    expect(testNode.id).toBe(nodeId);
    // Cannot directly test protected config, test via execute if needed
    // expect(testNode.config).toEqual(nodeConfig);
  });

  // Test individual protected metadata methods
  it('should return correct category from getCategory()', () => {
    expect((testNode as any).getCategory()).toBe(NodeCategory.CORE);
  });

  it('should return correct label from getLabel()', () => {
    expect((testNode as any).getLabel()).toBe('Test Node Label');
  });

  it('should return correct description from getDescription()', () => {
    expect((testNode as any).getDescription()).toBe('Test Node Description');
  });

  it('should return correct version from getVersion()', () => {
    expect((testNode as any).getVersion()).toBe(TestNode.VERSION);
  });

  it('should return correct compatibility from getCompatibility()', () => {
    expect((testNode as any).getCompatibility()).toEqual({ core: true, pro: true, custom: true });
  });

  it('should return correct inputs from getInputs()', () => {
    const inputs = (testNode as any).getInputs();
    expect(inputs).toEqual([
      { id: 'input1', type: 'string', label: 'Input 1', required: true },
      { id: 'input2', type: 'number', label: 'Input 2', required: false },
    ]);
  });

  it('should return correct outputs from getOutputs()', () => {
    const outputs = (testNode as any).getOutputs();
    expect(outputs).toEqual([{ id: 'output1', type: 'boolean', label: 'Output 1' }]);
  });

  it('should execute correctly', async () => {
    const inputData = { data: 'hello' };
    const result = await testNode.execute(inputData);
    expect(result).toEqual({ received: inputData });
  });

  it('should call cleanup without error', async () => {
    await expect(testNode.cleanup()).resolves.toBeUndefined();
  });
});
