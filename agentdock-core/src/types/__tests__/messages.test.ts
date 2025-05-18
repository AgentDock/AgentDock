import { MessageRole } from '../messages';

describe('Message Role', () => {
  it('should only contain expected values', () => {
    const values = Object.values(MessageRole);
    expect(values).toHaveLength(4);
    expect(values).toContain('user');
    expect(values).toContain('assistant');
    expect(values).toContain('system');
    expect(values).toContain('data');
  });
});
