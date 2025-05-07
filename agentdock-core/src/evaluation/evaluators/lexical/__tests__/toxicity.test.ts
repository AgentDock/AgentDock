import { ToxicityEvaluator, type ToxicityEvaluatorConfig } from '../toxicity';
import type { EvaluationInput, EvaluationCriteria, EvaluationResult, AgentMessage } from '../../../types';

// Mock helper
const createMockInput = (response: string | AgentMessage, criteria?: EvaluationCriteria[]): EvaluationInput => ({
  response,
  criteria: criteria || [{ name: 'ToxicityCheck', description: 'Test', scale: 'binary' }],
});

describe('ToxicityEvaluator', () => {
  const mockCriterion: EvaluationCriteria = { name: 'ToxicityCheck', description: 'Test toxicity', scale: 'binary' };

  describe('Constructor Error Handling', () => {
    it('should throw if criterionName is missing', () => {
      const config: Partial<ToxicityEvaluatorConfig> = { toxicTerms: ['badword'] }; 
      expect(() => new ToxicityEvaluator(config as ToxicityEvaluatorConfig))
        .toThrow('[ToxicityEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if criterionName is empty', () => {
      const config: Partial<ToxicityEvaluatorConfig> = { criterionName: ' ', toxicTerms: ['badword'] };
      expect(() => new ToxicityEvaluator(config as ToxicityEvaluatorConfig))
        .toThrow('[ToxicityEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if toxicTerms is missing or empty', () => {
      const config1: Partial<ToxicityEvaluatorConfig> = { criterionName: 'Test' }; // Missing toxicTerms
      const config2: ToxicityEvaluatorConfig = { criterionName: 'Test', toxicTerms: [] }; // Empty toxicTerms
      
      expect(() => new ToxicityEvaluator(config1 as ToxicityEvaluatorConfig))
          .toThrow('[ToxicityEvaluator] toxicTerms array must be provided and non-empty.');
      expect(() => new ToxicityEvaluator(config2))
          .toThrow('[ToxicityEvaluator] toxicTerms array must be provided and non-empty.');
    });
  });

  describe('Core Toxicity Checks', () => {
    const toxicTerms = ['darn', 'heck', 'badword'];
    const config: ToxicityEvaluatorConfig = { criterionName: 'ToxicityCheck', toxicTerms };
    const evaluator = new ToxicityEvaluator(config);

    it('should return score=true (not toxic) when no toxic terms are found', async () => {
      const input = createMockInput('This is a clean response.');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain('No configured toxic terms found');
      expect(results[0].metadata?.foundToxicTerms).toEqual([]);
    });

    it('should return score=false (toxic) when a toxic term is found', async () => {
      const input = createMockInput('This response has a badword in it.');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain('Found toxic terms: [badword]');
      expect(results[0].metadata?.foundToxicTerms).toEqual(['badword']);
    });

    it('should find multiple toxic terms', async () => {
      const input = createMockInput('Oh darn it, what the heck?');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      // Order might vary depending on regex execution, check presence
      expect(results[0].reasoning).toContain('Found toxic terms: [');
      expect(results[0].metadata?.foundToxicTerms).toEqual(expect.arrayContaining(['darn', 'heck']));
      expect(results[0].metadata?.foundToxicTerms).toHaveLength(2);
    });

    it('should be case-insensitive by default', async () => {
      const input = createMockInput('What the HECK is going on?');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['heck']);
    });

    it('should be case-sensitive when configured', async () => {
      const caseSensitiveConfig: ToxicityEvaluatorConfig = { ...config, caseSensitive: true };
      const caseSensitiveEvaluator = new ToxicityEvaluator(caseSensitiveConfig);
      const input = createMockInput('What the HECK is going on, darn it?'); // Only 'darn' matches case
      const results = await caseSensitiveEvaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['darn']); // heck shouldn't match
    });

    it('should match whole words by default', async () => {
        const configWW = { criterionName: 'ToxicityCheck', toxicTerms: ['ass'] };
        const evaluatorWW = new ToxicityEvaluator(configWW);
        const input = createMockInput('Assuming this passes assessment.'); // Contains 'ass' as substring
        const results = await evaluatorWW.evaluate(input, [mockCriterion]);
        expect(results[0].score).toBe(true); // Should not find toxic term
        expect(results[0].metadata?.foundToxicTerms).toEqual([]);
    });
    
    it('should match substrings when matchWholeWord is false', async () => {
        const configSub = { 
            criterionName: 'ToxicityCheck', 
            toxicTerms: ['ass'], 
            matchWholeWord: false // Explicitly allow substring match
        };
        const evaluatorSub = new ToxicityEvaluator(configSub);
        const input = createMockInput('Assuming this passes assessment.'); // Contains 'ass' as substring
        const results = await evaluatorSub.evaluate(input, [mockCriterion]);
        expect(results[0].score).toBe(false); // Should find toxic term
        expect(results[0].metadata?.foundToxicTerms).toEqual(['ass']);
    });
    
    it('should handle regex special characters in toxic terms correctly', async () => {
      const specialTerms = ['a+b', 'c*d', 'e?f', '(g)'];
      const configSpecial: ToxicityEvaluatorConfig = { 
        criterionName: 'ToxicityCheck', 
        toxicTerms: specialTerms, 
        matchWholeWord: false 
      };
      const evaluatorSpecial = new ToxicityEvaluator(configSpecial);
      const inputText = 'Literal text with a+b and c*d and e?f and (g).';
      const results = await evaluatorSpecial.evaluate(createMockInput(inputText), [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toHaveLength(4);
      expect(results[0].metadata?.foundToxicTerms).toEqual(expect.arrayContaining(specialTerms));
    });

    it('should handle different sourceTextFields', async () => {
      const configPrompt: ToxicityEvaluatorConfig = { ...config, sourceTextField: 'prompt' };
      const evaluatorPrompt = new ToxicityEvaluator(configPrompt);
      const input = createMockInput('clean response');
      input.prompt = 'This prompt is darn bad.'; // Toxic prompt
      const results = await evaluatorPrompt.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['darn']);
    });

    it('should return error result if source field is missing/not string', async () => {
      const evaluator = new ToxicityEvaluator(config);
      const input = createMockInput({ complex: 'object' } as any);
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false); // Default error score for binary
      expect(results[0].error).toBeDefined();
      expect(results[0].reasoning).toContain("Source text field 'response' did not yield a string");
    });

    it('should return empty result if criterion does not match', async () => {
      const evaluator = new ToxicityEvaluator(config);
      const otherCriterion: EvaluationCriteria = { name: 'Other', description:'', scale: 'binary' };
      const input = createMockInput('clean response', [otherCriterion]);
      const results = await evaluator.evaluate(input, [otherCriterion]);
      expect(results).toHaveLength(0);
    });
  });

  // TODO: Add tests for core toxicity checks, case sensitivity, whole word matching, etc.

}); 