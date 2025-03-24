import { MessageRole } from '../messages';

describe('Message Role', () => {
  it('should be immutable', () => {
    expect(() => {
      // TypeScript will prevent this at compile time, but we test it at runtime
      (MessageRole as any).USER = 'something-else';
    }).toThrow();
  });

  it('should only contain expected values', () => {
    const values = Object.values(MessageRole);
    expect(values).toHaveLength(5);
    expect(values).toContain('user');
    expect(values).toContain('assistant');
    expect(values).toContain('system');
    expect(values).toContain('tool');
    expect(values).toContain('data');
  });
}); 