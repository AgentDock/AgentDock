import type { AgentMessage, EvaluationInput } from '../../types';
import { getInputText } from '../input-text-extractor';

const mockAgentMessage = (text: string): AgentMessage => ({
  id: 'test-msg',
  role: 'assistant',
  content: text, // Keep simple content for basic tests if not directly used by contentParts logic
  contentParts: [{ type: 'text', text }],
  createdAt: new Date()
});

describe('getInputText', () => {
  const baseInput: EvaluationInput = {
    response: mockAgentMessage('This is the agent response.'),
    prompt: 'This is the prompt.',
    groundTruth: 'This is the ground truth.',
    criteria: [], // Not used by getInputText
    context: {
      userProfile: {
        name: 'Oz',
        level: 100
      },
      someOtherField: 'contextual value'
    }
  };

  it('should return response text by default', () => {
    expect(getInputText(baseInput)).toBe('This is the agent response.');
  });

  it("should return response text when sourceField is 'response'", () => {
    expect(getInputText(baseInput, 'response')).toBe(
      'This is the agent response.'
    );
  });

  it("should return prompt text when sourceField is 'prompt'", () => {
    expect(getInputText(baseInput, 'prompt')).toBe('This is the prompt.');
  });

  it("should return groundTruth text when sourceField is 'groundTruth'", () => {
    expect(getInputText(baseInput, 'groundTruth')).toBe(
      'This is the ground truth.'
    );
  });

  it('should return context text for a direct context field', () => {
    expect(getInputText(baseInput, 'context.someOtherField')).toBe(
      'contextual value'
    );
  });

  it('should return context text for a nested context field', () => {
    expect(getInputText(baseInput, 'context.userProfile.name')).toBe('Oz');
  });

  it('should return undefined for a non-existent direct context field', () => {
    expect(getInputText(baseInput, 'context.nonExistent')).toBeUndefined();
  });

  it('should return undefined for a non-existent nested context field', () => {
    expect(
      getInputText(baseInput, 'context.userProfile.nonExistent')
    ).toBeUndefined();
  });

  it('should return undefined for a context path that goes too deep', () => {
    expect(
      getInputText(baseInput, 'context.someOtherField.deeper')
    ).toBeUndefined();
  });

  it('should return undefined for an invalid sourceField', () => {
    expect(getInputText(baseInput, 'invalidField')).toBeUndefined();
  });

  it('should handle string response directly', () => {
    const inputWithStringResponse: EvaluationInput = {
      ...baseInput,
      response: 'Simple string response'
    };
    expect(getInputText(inputWithStringResponse, 'response')).toBe(
      'Simple string response'
    );
  });

  it('should handle AgentMessage without text part in contentParts gracefully', () => {
    const inputWithNonTextMessage: EvaluationInput = {
      ...baseInput,
      response: {
        id: 'msg-no-text',
        role: 'assistant',
        content: 'Fallback content',
        contentParts: [
          { type: 'image', url: 'http://example.com/img.png' } as any
        ], // Cast as any to fit AgentMessage type for test
        createdAt: new Date()
      }
    };
    expect(getInputText(inputWithNonTextMessage, 'response')).toBeUndefined();
  });

  it('should handle AgentMessage with empty contentParts gracefully', () => {
    const inputWithEmptyPartsMessage: EvaluationInput = {
      ...baseInput,
      response: {
        id: 'msg-empty-parts',
        role: 'assistant',
        content: 'Fallback content',
        contentParts: [],
        createdAt: new Date()
      }
    };
    expect(
      getInputText(inputWithEmptyPartsMessage, 'response')
    ).toBeUndefined();
  });

  it('should handle AgentMessage where contentParts is undefined', () => {
    const inputWithUndefinedPartsMessage: EvaluationInput = {
      ...baseInput,
      response: {
        id: 'msg-undefined-parts',
        role: 'assistant',
        content: 'This is some content string for response', // Vercel AI SDK might put string here
        // contentParts is deliberately undefined
        createdAt: new Date()
      }
    };
    // According to current getInputText logic, if contentParts is undefined, it won't find text there.
    // And if input.response itself is not a string, it won't get 'This is some content string for response'
    // unless input.response was *just* the string itself.
    // This test case is tricky because AgentMessage type allows input.response to be string OR AgentMessage.
    // If it's AgentMessage but contentParts is missing, it should correctly return undefined.
    expect(
      getInputText(inputWithUndefinedPartsMessage, 'response')
    ).toBeUndefined();
  });

  it('should return undefined if groundTruth is an object and sourceField is groundTruth', () => {
    const inputWithObjectGt: EvaluationInput = {
      ...baseInput,
      groundTruth: { complex: 'object' }
    };
    expect(getInputText(inputWithObjectGt, 'groundTruth')).toBeUndefined();
  });

  it('should return string if groundTruth is a string and sourceField is groundTruth', () => {
    const inputWithStringGt: EvaluationInput = {
      ...baseInput,
      groundTruth: 'stringy gt'
    };
    expect(getInputText(inputWithStringGt, 'groundTruth')).toBe('stringy gt');
  });

  it('should return undefined for context field that is not a string', () => {
    const inputWithNumericContext: EvaluationInput = {
      ...baseInput,
      context: {
        ...baseInput.context,
        numericField: 12345
      }
    };
    expect(
      getInputText(inputWithNumericContext, 'context.numericField')
    ).toBeUndefined();
  });
});
