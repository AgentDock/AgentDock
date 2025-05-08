import { KeywordCoverageEvaluator, type KeywordCoverageEvaluatorConfig } from '../keyword_coverage';
import type { EvaluationInput, EvaluationCriteria, EvaluationResult, AgentMessage } from '../../../types';

// Mock helper (can reuse or adapt from other tests)
const createMockInput = (response: string | AgentMessage, groundTruth?: string | any, context?: Record<string, any>, criteria?: EvaluationCriteria[]): EvaluationInput => ({
  response,
  groundTruth,
  context,
  criteria: criteria || [{ name: 'KeywordCoverage', description: 'Test', scale: 'numeric' }],
});

describe('KeywordCoverageEvaluator', () => {
  const mockCriterion: EvaluationCriteria = { name: 'KeywordCoverage', description: 'Test keyword coverage', scale: 'numeric' };

  describe('Constructor Error Handling', () => {
    it('should throw if criterionName is missing', () => {
      const config: Partial<KeywordCoverageEvaluatorConfig> = { expectedKeywords: ['a'] }; // Missing criterionName
      expect(() => new KeywordCoverageEvaluator(config as KeywordCoverageEvaluatorConfig))
        .toThrow('[KeywordCoverageEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if criterionName is empty', () => {
      const config: Partial<KeywordCoverageEvaluatorConfig> = { criterionName: ' ', expectedKeywords: ['a'] };
      expect(() => new KeywordCoverageEvaluator(config as KeywordCoverageEvaluatorConfig))
        .toThrow('[KeywordCoverageEvaluator] criterionName must be provided and non-empty.');
    });
    
    it('should throw if keywordsSourceField is config (or default) and expectedKeywords is missing/empty', () => {
        const config1: Partial<KeywordCoverageEvaluatorConfig> = { criterionName: 'Test' }; // Missing expectedKeywords
        const config2: KeywordCoverageEvaluatorConfig = { criterionName: 'Test', expectedKeywords: [] }; // Empty expectedKeywords
        
        const expectedErrorMsg = '[KeywordCoverageEvaluator] expectedKeywords must be provided in config when keywordsSourceField is \'config\' or default.';
        expect(() => new KeywordCoverageEvaluator(config1 as KeywordCoverageEvaluatorConfig))
            .toThrow(expectedErrorMsg);
        expect(() => new KeywordCoverageEvaluator(config2))
            .toThrow(expectedErrorMsg);
    });
    
    it('should NOT throw if keywordsSourceField is not config and expectedKeywords is missing', () => {
        const config1: KeywordCoverageEvaluatorConfig = { criterionName: 'Test', keywordsSourceField: 'groundTruth' };
        const config2: KeywordCoverageEvaluatorConfig = { criterionName: 'Test', keywordsSourceField: 'context.someField' };
        
        expect(() => new KeywordCoverageEvaluator(config1)).not.toThrow();
        expect(() => new KeywordCoverageEvaluator(config2)).not.toThrow();
    });
  });

  describe('Core Coverage Calculation', () => {
    const keywords = ['apple', 'banana', 'cherry'];
    const config: KeywordCoverageEvaluatorConfig = { 
      criterionName: 'KeywordCoverage', 
      expectedKeywords: keywords 
    };
    const evaluator = new KeywordCoverageEvaluator(config);

    it('should return score 1 when all keywords are present', async () => {
      const input = createMockInput('I like apple, banana, and cherry.');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain('Found 3 out of 3 keywords.');
    });

    it('should return score 0 when no keywords are present', async () => {
      const input = createMockInput('I like grapes and oranges.');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(0);
      expect(results[0].reasoning).toContain('Found 0 out of 3 keywords.');
    });

    it('should return partial score when some keywords are present', async () => {
      const input = createMockInput('I only like apple and BANANA.'); // banana case different
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(2 / 3);
      expect(results[0].reasoning).toContain('Found 2 out of 3 keywords.');
    });

    it('should be case-insensitive by default', async () => {
      const input = createMockInput('I like APPLE, BANANA, and CHERRY.');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain('Found 3 out of 3 keywords.');
    });

    it('should be case-sensitive when configured', async () => {
      const caseSensitiveConfig: KeywordCoverageEvaluatorConfig = { ...config, caseSensitive: true };
      const caseSensitiveEvaluator = new KeywordCoverageEvaluator(caseSensitiveConfig);
      const input = createMockInput('I like apple, BANANA, and cherry.'); // BANANA wrong case
      const results = await caseSensitiveEvaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(2 / 3);
      expect(results[0].reasoning).toContain('Found 2 out of 3 keywords.');
    });
    
    // Removed tests for matchWholeWord as the config option does not exist
    // The evaluator currently always does substring matching via .includes()
    // it('should match whole words by default', ...) 
    // it('should match substrings when matchWholeWord is false', ...)
    
    // Note: Whitespace normalization is not directly configurable for keywords, but is for source text.
  });

  describe('Keyword and Field Sourcing', () => {
    const mockCriterion: EvaluationCriteria = { name: 'KeywordCoverage', description: 'Test keyword coverage', scale: 'numeric' };

    it('should source keywords from groundTruth (string) if configured', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'groundTruth' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Response text with keyword1 and keyword2.', 'keyword1 keyword2');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 2 out of 2 keywords. Coverage: 100.00%');
    });

    it('should source keywords from groundTruth (array) if configured', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'groundTruth' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Response text with keyword1 and keyword2.', ['keyword1', 'keyword2']);
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 2 out of 2 keywords. Coverage: 100.00%');
    });

    it('should source keywords from a context field (string) if configured', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'context.myKeywords' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Response text with termA and termB.', undefined, { myKeywords: 'termA termB' });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 2 out of 2 keywords. Coverage: 100.00%');
    });

    it('should source keywords from a context field (array) if configured', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'context.myKeywords' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Response text with termA and termB.', undefined, { myKeywords: ['termA', 'termB'] });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 2 out of 2 keywords. Coverage: 100.00%');
    });

    it('should handle missing keywordsSourceField gracefully (returning error score)', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'context.nonExistent' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Some response.', undefined, { anotherKey: 'value' });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe('error');
      expect(results[0].reasoning).toContain('Failed to source keywords from context.nonExistent');
      expect(results[0].error).toContain('Keywords source context.nonExistent not found or not a string/array.');
    });
    
    it('should handle keywordsSourceField being of invalid type (returning error score)', async () => {
      const config: KeywordCoverageEvaluatorConfig = { 
        criterionName: 'KeywordCoverage', 
        keywordsSourceField: 'context.invalidType' 
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Some response.', undefined, { invalidType: 123 }); // Number instead of string/array
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe('error');
      expect(results[0].reasoning).toContain('Failed to source keywords from context.invalidType');
      expect(results[0].error).toContain('Keywords source context.invalidType not found or not a string/array.');
    });

    it('should use sourceTextField to get text from response (AgentMessage content)', async () => {
      const config: KeywordCoverageEvaluatorConfig = {
        criterionName: 'KeywordCoverage',
        expectedKeywords: ['important'],
        sourceTextField: 'response',
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const textContent = 'This is an important message.';
      const agentMessageResponse: AgentMessage = {
        id: 'msg1',
        role: 'assistant',
        content: textContent, // content is a string
        contentParts: [{ type: 'text', text: textContent }], // contentParts is the array
        createdAt: new Date(),
      };
      const input = createMockInput(agentMessageResponse);
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 1 out of 1 keywords. Coverage: 100.00%');
    });

    it('should use sourceTextField to get text from groundTruth', async () => {
      const config: KeywordCoverageEvaluatorConfig = {
        criterionName: 'KeywordCoverage',
        expectedKeywords: ['key'],
        sourceTextField: 'groundTruth.details.text',
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Any response', { details: { text: 'This is the key information.' } });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 1 out of 1 keywords. Coverage: 100.00%');
    });

    it('should use sourceTextField to get text from context', async () => {
      const config: KeywordCoverageEvaluatorConfig = {
        criterionName: 'KeywordCoverage',
        expectedKeywords: ['target'],
        sourceTextField: 'context.data.value',
      };
      const evaluator = new KeywordCoverageEvaluator(config);
      const input = createMockInput('Any response', undefined, { data: { value: 'The target word is here.' } });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(1);
      expect(results[0].reasoning).toContain('Found 1 out of 1 keywords. Coverage: 100.00%');
    });

    it('should handle missing sourceTextField gracefully (returning error score)', async () => {
        const config: KeywordCoverageEvaluatorConfig = {
            criterionName: 'KeywordCoverage',
            expectedKeywords: ['test'],
            sourceTextField: 'context.nonExistent.path',
        };
        const evaluator = new KeywordCoverageEvaluator(config);
        const input = createMockInput('Response');
        const results = await evaluator.evaluate(input, [mockCriterion]);
        expect(results[0].score).toBe('error');
        expect(results[0].reasoning).toContain('Evaluation failed: Source text field \'context.nonExistent.path\' did not yield a string or was not found.');
        expect(results[0].error).toContain('Source text field context.nonExistent.path not found in input or content is not a string.');
    });
  });

  // TODO: Add tests for core sentiment analysis, output types, field sourcing, etc.
  // TODO: Add tests for other algorithms, field sourcing, etc.
  // TODO: Add tests for core toxicity checks, case sensitivity, whole word matching, etc.
  // TODO: More tests for multiple rules, etc.

}); 