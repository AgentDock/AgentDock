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
    expect(result.reasoning).toContain('LLM Judge evaluation failed due to error during LLM call or processing.');
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
    expect(result.reasoning).toBe("Score normalization failed: Invalid value for likert5 scale: undefined. Expected integer between 1 and 5.. Raw LLM reasoning: Response was clear but I forgot the score.");
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

  describe('Likert Scale Normalization and Zod Schema', () => {
    beforeEach(() => {
      evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'Clarity', // Uses likert5 scale by default in mockClarityCriterion
        promptTemplate: "Evaluate for {{criterion_name}}",
      };
    });

    it('should use ZodNumber for likert5 scale in generateObject schema', async () => {
      const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
      mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: 3, reasoning: 'So-so' } });
      await evaluator.evaluate(mockInput, allMockCriteria); // mockInput uses allMockCriteria including Clarity (likert5)
      expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
      const generateObjectCallArgs = mockAISDKGenerateObjectImpl.mock.calls[0][0];
      expect(generateObjectCallArgs.schema.shape.score._def.typeName).toBe('ZodNumber');
    });

    const validLikertScores = [
      { llmScore: 5, expected: 5, reasoning: 'Perfectly clear' },
      { llmScore: 1, expected: 1, reasoning: 'Not clear at all' },
      { llmScore: "3", expected: 3, reasoning: 'Average clarity' }, // String input
    ];
    validLikertScores.forEach(({ llmScore, expected, reasoning }) => {
      it(`should correctly parse and use valid Likert score: ${llmScore} (string or number)`, async () => {
        const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
        mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: llmScore, reasoning } });
        const results = await evaluator.evaluate(mockInput, allMockCriteria);
        expect(results[0].score).toBe(expected);
        expect(results[0].reasoning).toBe(reasoning);
        expect(results[0].error).toBeUndefined();
      });
    });

    const invalidLikertScores = [
      { llmScore: 0, errorMsgContains: 'Invalid value for likert5 scale: 0' },
      { llmScore: 6, errorMsgContains: 'Invalid value for likert5 scale: 6' },
      { llmScore: 3.5, errorMsgContains: 'Invalid value for likert5 scale: 3.5' }, // Non-integer
      { llmScore: "2.5", errorMsgContains: 'Invalid value for likert5 scale: 2.5' }, // String non-integer
      { llmScore: "apple", errorMsgContains: 'Invalid value for likert5 scale: apple' },
      { llmScore: null, errorMsgContains: 'Invalid value for likert5 scale: null' },
      { llmScore: undefined, errorMsgContains: 'Invalid value for likert5 scale: undefined' }, // Caught by schema validation
    ];
    invalidLikertScores.forEach(({ llmScore, errorMsgContains }) => {
      it(`should return error for invalid Likert score: ${llmScore}`, async () => {
        const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
        // For undefined, the Zod schema itself will cause generateObject to effectively error or return non-conformant data
        // For other invalid types, it's the normalization within LLMJudge that catches it.
        if (llmScore === undefined) {
            mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { reasoning: 'Forgot score' } }); // Simulates missing score from LLM
        } else {
            mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: llmScore, reasoning: 'Invalid score provided' } });
        }
        const results = await evaluator.evaluate(mockInput, allMockCriteria);
        expect(results[0].score).toBe('error');
        expect(results[0].error).toBeDefined();
        expect(results[0].error).toContain(errorMsgContains);
      });
    });
  });

  describe('Numeric Scale Normalization and Zod Schema', () => {
    const mockNumericCriterion: EvaluationCriteria = { name: 'Certainty', description: 'How certain?', scale: 'numeric' };
    const numericMockInput: EvaluationInput = { ...mockInput, criteria: [mockNumericCriterion] };

    beforeEach(() => {
      evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'Certainty', 
        promptTemplate: "Evaluate for {{criterion_name}}",
      };
    });

    it('should use ZodNumber for numeric scale in generateObject schema', async () => {
      const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
      mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: 0.8, reasoning: 'Fairly certain' } });
      await evaluator.evaluate(numericMockInput, [mockNumericCriterion]);
      expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
      const generateObjectCallArgs = mockAISDKGenerateObjectImpl.mock.calls[0][0];
      expect(generateObjectCallArgs.schema.shape.score._def.typeName).toBe('ZodNumber');
    });

    const validNumericScores = [
      { llmScore: 0.75, expected: 0.75, reasoning: 'Score is 0.75' },
      { llmScore: "0.5", expected: 0.5, reasoning: 'Score is 0.5 string' },
      { llmScore: 100, expected: 100, reasoning: 'Score is 100' }, // Will be normalized by runner if needed
      { llmScore: "75", expected: 75, reasoning: 'Score is 75 string' }, // Will be normalized by runner
      { llmScore: 0, expected: 0, reasoning: 'Score is 0' },
    ];
    validNumericScores.forEach(({ llmScore, expected, reasoning }) => {
      it(`should correctly parse and use valid numeric score: ${llmScore}`, async () => {
        const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
        mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: llmScore, reasoning } });
        const results = await evaluator.evaluate(numericMockInput, [mockNumericCriterion]);
        expect(results[0].score).toBe(expected);
        expect(results[0].reasoning).toBe(reasoning);
        expect(results[0].error).toBeUndefined();
      });
    });

    const invalidNumericScores = [
      { llmScore: "ninety", errorMsgContains: 'Invalid value for numeric scale: ninety' },
      { llmScore: null, errorMsgContains: 'Invalid value for numeric scale: null' },
      { llmScore: undefined, errorMsgContains: 'Invalid value for numeric scale: undefined' }, // Caught by schema
    ];
    invalidNumericScores.forEach(({ llmScore, errorMsgContains }) => {
      it(`should return error for invalid numeric score: ${llmScore}`, async () => {
        const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
        if (llmScore === undefined) {
            mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { reasoning: 'Forgot score for numeric' } });
        } else {
            mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: llmScore, reasoning: 'Invalid numeric score provided' } });
        }
        const results = await evaluator.evaluate(numericMockInput, [mockNumericCriterion]);
        expect(results[0].score).toBe('error');
        expect(results[0].error).toBeDefined();
        expect(results[0].error).toContain(errorMsgContains);
      });
    });
  });

  describe('Prompt Templating', () => {
    const PROMPT_FOR_SYSTEM_PROMPT_TEST =
      'Response: {{response}}\n' +
      'Prompt: {{input}}\n' +
      'Criterion Name: {{criterion_name}}\n' +
      'Criterion Description: {{criterion_description}}\n' +
      'Criterion Scale: {{criterion_scale}}\n' +
      'Ground Truth: {{reference}}\n' +
      'Context Custom Key: {{context.customKey}}';
      
    const mockTemplatingCriterion: EvaluationCriteria = { name: 'TemplatingTest', description: 'Does it template well?', scale: 'binary' };
    const inputForTemplate: EvaluationInput = {
      response: mockAgentMessage('Agent Output for Template'),
      prompt: 'User Input for Template',
      criteria: [mockTemplatingCriterion],
      context: { customKey: 'Custom Context Value' },
      groundTruth: 'GT for Template'
    };

    it('should correctly populate all standard template variables', async () => {
      evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'TemplatingTest',
        promptTemplate: PROMPT_FOR_SYSTEM_PROMPT_TEST,
      };
      const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
      mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: true, reasoning: 'Templated!' } });

      await evaluator.evaluate(inputForTemplate, [mockTemplatingCriterion]);

      expect(mockAISDKGenerateObjectImpl).toHaveBeenCalledTimes(1);
      const populatedPrompt = mockAISDKGenerateObjectImpl.mock.calls[0][0].prompt;
      
      expect(populatedPrompt).toContain("Response: Agent Output for Template");
      expect(populatedPrompt).toContain("Prompt: User Input for Template");
      expect(populatedPrompt).toContain("Criterion Name: TemplatingTest");
      expect(populatedPrompt).toContain("Criterion Description: Does it template well?");
      expect(populatedPrompt).toContain("Criterion Scale: binary");
      expect(populatedPrompt).toContain("Ground Truth: GT for Template");
      expect(populatedPrompt).toContain("Context Custom Key: Custom Context Value");
    });

    it('should handle missing optional fields in template gracefully (e.g. no prompt, no groundTruth)', async () => {
      const template = 
        "Response: {{response}}\n" +
        "Prompt: {{prompt}}\n" + // prompt is optional
        "Ground Truth: {{ground_truth}}"; // groundTruth is optional
      
      const minimalInput: EvaluationInput = {
        response: mockAgentMessage('Minimal Response'),
        criteria: [mockTemplatingCriterion],
        // No prompt, no groundTruth, no context
      };

      evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'TemplatingTest',
        promptTemplate: template,
      };
      const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
      mockAISDKGenerateObjectImpl.mockResolvedValueOnce({ object: { score: false, reasoning: 'Minimal templated' } });

      await evaluator.evaluate(minimalInput, [mockTemplatingCriterion]);
      const populatedPrompt = mockAISDKGenerateObjectImpl.mock.calls[0][0].prompt;

      expect(populatedPrompt).toContain("Response: Minimal Response");
      expect(populatedPrompt).toContain("Prompt: "); // Should be empty string or similar for missing optional
      expect(populatedPrompt).toContain("Ground Truth: "); // Should be empty string or similar
    });
    
    it('should stringify AgentMessage response content for the template', async () => {
      const agentMessageResponse: AgentMessage = {
        id: 'msg-complex',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello.' },
          { type: 'tool_call', toolName: 'foo', toolCallId: 'tc1', args: { bar: 1 } }
        ] as any, // Using 'as any' for the content property to bypass persistent linter error
        createdAt: new Date(), 
        contentParts: [
          { type: 'text', text: 'Hello.' },
          { type: 'tool_call', toolName: 'foo', toolCallId: 'tc1', args: { bar: 1 } }
        ]
      };
      const mockInputForComplexResponse: EvaluationInput = {
        response: agentMessageResponse,
        prompt: 'A simple prompt',
        criteria: [mockClarityCriterion], 
        context: {},
      };

      evaluatorConfig = {
        llm: mockLLMInstance,
        criterionName: 'Clarity',
        promptTemplate: "Response: {{response}}",
      };
      const evaluator = new LLMJudgeEvaluator(evaluatorConfig);
      
      let capturedPrompt = '';
      mockAISDKGenerateObjectImpl.mockImplementation(async (args) => {
        capturedPrompt = args.prompt;
        return { object: { score: 3, reasoning: 'ok' } };
      });

      await evaluator.evaluate(mockInputForComplexResponse, [mockClarityCriterion]);
      
      const expectedTextFromAgentMessage = "Hello."; 
      expect(capturedPrompt).toBe(`Response: ${expectedTextFromAgentMessage}`);
    });
  });
}); 

describe('LLMJudgeEvaluator - Constructor Error Handling', () => {
  const validLLM = { getModel: jest.fn() } as unknown as CoreLLM;
  const validCriterionName = 'TestCrit';
  const validPromptTemplate = 'Test Template';

  it('should throw if criterionName is missing', () => {
    expect(() => new LLMJudgeEvaluator({
      llm: validLLM,
      // criterionName: undefined,
      promptTemplate: validPromptTemplate
    } as any))
    .toThrow('[LLMJudgeEvaluator] criterionName must be a non-empty string.');
  });

  it('should throw if criterionName is empty', () => {
    expect(() => new LLMJudgeEvaluator({
      llm: validLLM,
      criterionName: ' ',
      promptTemplate: validPromptTemplate
    }))
    .toThrow('[LLMJudgeEvaluator] criterionName must be a non-empty string.');
  });

  it('should throw if llm is missing', () => {
    expect(() => new LLMJudgeEvaluator(({
      criterionName: 'Test',
      promptTemplate: validPromptTemplate
    } as any)))
    .toThrow('[LLMJudgeEvaluator] llm must be provided and appear to be a CoreLLM instance.');
  });

  it('should throw if promptTemplate is missing', () => {
    expect(() => new LLMJudgeEvaluator({
      llm: validLLM,
      criterionName: validCriterionName,
      // promptTemplate: undefined
    } as any))
    .toThrow('[LLMJudgeEvaluator] promptTemplate must be a non-empty string.');
  });

  it('should throw if promptTemplate is empty', () => {
    expect(() => new LLMJudgeEvaluator({
      llm: validLLM,
      criterionName: validCriterionName,
      promptTemplate: ' '
    }))
    .toThrow('[LLMJudgeEvaluator] promptTemplate must be a non-empty string.');
  });
}); 