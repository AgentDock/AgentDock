import { LLMJudgeEvaluator, type LLMJudgeConfig } from '../judge';
import type { EvaluationInput, EvaluationCriteria, EvaluationResult, AgentMessage } from '../../../types';
import { type CoreLLM } from '../../../../llm/core-llm';
import { z } from 'zod';

// ---- ROBUST MOCKING STRATEGY FOR HOISTING ----
// 1. Declare a `let` variable that will hold the mock implementation.
let mockAISDKGenerateObjectImpl = jest.fn();

// 2. CALL jest.mock with a factory function that *calls* the implementation.
jest.mock('ai', () => ({
  ...jest.requireActual('ai'), 
  generateObject: (...args: any[]) => mockAISDKGenerateObjectImpl(...args), // Ensures the latest impl is used
}));
// ---- END ROBUST MOCKING STRATEGY ----

// Other mocks
jest.mock('../../../../llm/core-llm'); 

const mockLLMInstance = {
  getModel: jest.fn(() => ({ someModelProperty: 'exists' })),
} as unknown as CoreLLM;

describe('LLMJudgeEvaluator', () => {
  const mockClarityCriterion: EvaluationCriteria = { name: 'Clarity', description: 'Is the response clear?', scale: 'likert5' };
  const mockRelevanceCriterion: EvaluationCriteria = { name: 'Relevance', description: 'Is the response relevant?', scale: 'binary' };
  const allMockCriteria: EvaluationCriteria[] = [mockClarityCriterion, mockRelevanceCriterion];

  const mockAgentMessage = (content: string): AgentMessage => ({
    id: 'test-msg',
    role: 'assistant',
    content,
    contentParts: [{ type: 'text', text: content }],
    createdAt: new Date(),
  });

  const mockInput: EvaluationInput = {
    response: mockAgentMessage('This is the agent response being judged.'),
    prompt: 'User question here',
    criteria: allMockCriteria,
    context: { someContext: 'data' },
  };

  let evaluatorConfig: LLMJudgeConfig;

  beforeEach(() => {
    // Reset the mock implementation for each test to ensure clean state
    mockAISDKGenerateObjectImpl = jest.fn();
    // jest.clearAllMocks(); // This would clear call counts on the jest.fn() itself if needed, but we reassign
  });

  it('should correctly evaluate its configured criterion based on LLM output', async () => {
    evaluatorConfig = {
      llm: mockLLMInstance, 
      criterionName: 'Clarity',
      promptTemplate: "Evaluate {{response}} for {{criterion_name}}: {{criterion_description}}. Scale: {{criterion_scale}}",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);

    mockAISDKGenerateObjectImpl.mockResolvedValueOnce({
      object: { score: 4, reasoning: 'Response was mostly clear.' }
    });

    const results = await evaluator.evaluate(mockInput, allMockCriteria);

    expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);

    const clarityResult = results[0];
    expect(clarityResult.criterionName).toBe('Clarity');
    expect(clarityResult.score).toBe(4);
    expect(clarityResult.reasoning).toBe('Response was mostly clear.');
    expect(clarityResult.evaluatorType).toBe('LLMJudge');
    const generateObjectCallArgs = mockAISDKGenerateObjectImpl.mock.calls[0][0];
    expect(generateObjectCallArgs.schema.shape.score._def.typeName).toBe('ZodNumber');
  });

  it('should return empty results if its configured criterion is not in the input criteria list', async () => {
    evaluatorConfig = {
      llm: mockLLMInstance,
      criterionName: 'Fluency',
      promptTemplate: "Template for Fluency",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);

    const results = await evaluator.evaluate(mockInput, allMockCriteria);
    expect(mockAISDKGenerateObjectImpl).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('should handle LLM call failure gracefully for its criterion', async () => {
    evaluatorConfig = {
      llm: mockLLMInstance,
      criterionName: 'Relevance',
      promptTemplate: "Template for Relevance",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
    const llmError = new Error('LLM API Error');
    mockAISDKGenerateObjectImpl.mockRejectedValueOnce(llmError);

    const results = await evaluator.evaluate(mockInput, allMockCriteria);
    expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.criterionName).toBe('Relevance');
    expect(result.score).toBe('error'); 
    expect(result.error).toBeDefined();
    expect(result.error).toContain('LLM API Error');
    expect(result.reasoning).toContain('LLM Judge evaluation failed due to error.');
  });

  it('should handle failure if LLM output does not match Zod schema (e.g. missing score)', async () => {
    evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'Clarity',
        promptTemplate: "Template for Clarity",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
    mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { reasoning: 'Response was clear but I forgot the score.' } });

    const results = await evaluator.evaluate(mockInput, allMockCriteria);
    expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.criterionName).toBe('Clarity');
    expect(result.score).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.error).toBe("Score normalization failed: Invalid value for likert5 scale: undefined. Expected integer between 1 and 5."); 
    expect(result.reasoning).toContain('LLM Judge evaluation failed due to error.');
  });
  
  it('should correctly use binary Zod schema for binary/pass-fail scales', async () => {
    evaluatorConfig = {
      llm: mockLLMInstance,
      criterionName: 'Relevance', 
      promptTemplate: "Evaluate {{response}} for {{criterion_name}}",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
    mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: true, reasoning: 'Relevant' } });

    await evaluator.evaluate(mockInput, allMockCriteria);
    expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
    const generateObjectCallArgs = mockAISDKGenerateObjectImpl.mock.calls[0][0];
    expect(generateObjectCallArgs.schema.shape.score._def.typeName).toBe('ZodUnion');
  });

  it('should normalize various string inputs for binary scale correctly', async () => {
    evaluatorConfig = {
      llm: mockLLMInstance,
      criterionName: 'Relevance', 
      promptTemplate: "Template",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
    const testCases = [
      { llmScore: 'true', expected: true }, { llmScore: 'Pass', expected: true }, { llmScore: 'YES', expected: true }, {llmScore: '1', expected: true},
      { llmScore: 'false', expected: false }, { llmScore: 'fail', expected: false }, { llmScore: 'NO', expected: false }, {llmScore: '0', expected: false}
    ];
    for (const tc of testCases) {
      mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: tc.llmScore, reasoning: 'test' } });
      const results = await evaluator.evaluate(mockInput, allMockCriteria);
      expect(results[0].criterionName).toBe('Relevance');
      expect(results[0].score).toBe(tc.expected);
    }
  });

  it('should return error for unparseable string for binary scale (caught by LLMJudgeEvaluator normalization)', async () => {
    evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'Relevance', 
        promptTemplate: "Template",
    };
    const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
    mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: 'maybe', reasoning: 'Uncertain'} });

    const results = await evaluator.evaluate(mockInput, allMockCriteria);
    expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
    expect(results[0].score).toBe('error');
    expect(results[0].error).toBeDefined();
    expect(results[0].error).toContain("Invalid value for binary scale: maybe. Expected boolean or standard affirmative/negative string.");
  });

  // ... more tests to come
}); 