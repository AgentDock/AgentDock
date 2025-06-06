import { NodeCategory } from '../node-category';

describe('NodeCategory', () => {
  it('should have the correct values', () => {
    expect(NodeCategory.CORE).toBe('core');
    expect(NodeCategory.CUSTOM).toBe('custom');
  });

  it('should be immutable', () => {
    expect(() => {
      (NodeCategory as any).CORE = 'something-else';
    }).toThrow();
  });

  it('should only contain expected values', () => {
    const values = Object.values(NodeCategory);
    expect(values).toHaveLength(2);
    expect(values).toContain('core');
    expect(values).toContain('custom');
  });

  it('should be usable as a type', () => {
    const testFunction = (category: NodeCategory): NodeCategory => category;

    // Should compile
    expect(testFunction(NodeCategory.CORE)).toBe('core');
    expect(testFunction(NodeCategory.CUSTOM)).toBe('custom');

    // @ts-expect-error - This should fail type checking
    testFunction('other');
  });
});
