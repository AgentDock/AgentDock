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

  // TODO: Add tests for keyword/field sourcing, etc.

}); 