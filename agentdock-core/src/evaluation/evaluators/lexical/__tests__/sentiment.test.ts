import { SentimentEvaluator, type SentimentEvaluatorConfig } from '../sentiment';
import type { EvaluationInput, EvaluationCriteria, EvaluationResult, AgentMessage } from '../../../types';

// Mock helper
const createMockInput = (response: string | AgentMessage, criteria?: EvaluationCriteria[]): EvaluationInput => ({
  response,
  criteria: criteria || [{ name: 'SentimentTest', description: 'Test', scale: 'numeric' }],
});

describe('SentimentEvaluator', () => {
  const mockCriterionNumeric: EvaluationCriteria = { name: 'SentimentTest', description: 'Test sentiment', scale: 'numeric' };
  const mockCriterionCategory: EvaluationCriteria = { name: 'SentimentCategory', description: 'Test sentiment category', scale: 'string' }; // Assuming string scale for categories

  describe('Constructor Error Handling', () => {
    it('should throw if criterionName is missing', () => {
      const config: Partial<SentimentEvaluatorConfig> = {};
      expect(() => new SentimentEvaluator(config as SentimentEvaluatorConfig))
        .toThrow('[SentimentEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if criterionName is empty', () => {
      const config: SentimentEvaluatorConfig = { criterionName: ' ' };
      expect(() => new SentimentEvaluator(config))
        .toThrow('[SentimentEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if positiveThreshold <= negativeThreshold for category output', () => {
      const config: SentimentEvaluatorConfig = { 
        criterionName: 'Test', 
        outputType: 'category', 
        positiveThreshold: 0.1, 
        negativeThreshold: 0.2 // Invalid: negative >= positive
      };
      const expectedError = '[SentimentEvaluator] negativeThreshold must be less than positiveThreshold for category output.';
      expect(() => new SentimentEvaluator(config))
        .toThrow(expectedError);
    });
  });

  describe('Core Sentiment Analysis', () => {
    const positiveText = 'This is a wonderful and amazing experience! Great job!'; // Should be positive
    const negativeText = 'This is a terrible, awful, bad situation. Horrible.'; // Should be negative
    const neutralText = 'This statement is neutral.'; // Should be neutral

    it('should output normalized comparative score (0-1) by default', async () => {
      const config: SentimentEvaluatorConfig = { criterionName: 'SentimentTest' }; // Default output type
      const evaluator = new SentimentEvaluator(config);
      
      const resultsPositive = await evaluator.evaluate(createMockInput(positiveText), [mockCriterionNumeric]);
      const resultsNegative = await evaluator.evaluate(createMockInput(negativeText), [mockCriterionNumeric]);
      const resultsNeutral = await evaluator.evaluate(createMockInput(neutralText), [mockCriterionNumeric]);

      expect(resultsPositive[0].score).toBeGreaterThan(0.5); // Positive comparative normalized
      expect(resultsNegative[0].score).toBeLessThan(0.5); // Negative comparative normalized
      // Neutral might be close to 0.5, using toBeCloseTo
      expect(resultsNeutral[0].score).toBeCloseTo(0.5, 1); // Comparative for neutral is 0, normalized is 0.5
      expect(resultsPositive[0].reasoning).toContain('comparativeNormalized');
    });

    it('should output raw AFINN score when outputType is rawScore', async () => {
      const config: SentimentEvaluatorConfig = { criterionName: 'SentimentTest', outputType: 'rawScore' };
      const evaluator = new SentimentEvaluator(config);
      
      const resultsPositive = await evaluator.evaluate(createMockInput(positiveText), [mockCriterionNumeric]);
      const resultsNegative = await evaluator.evaluate(createMockInput(negativeText), [mockCriterionNumeric]);
      const resultsNeutral = await evaluator.evaluate(createMockInput(neutralText), [mockCriterionNumeric]);
      
      // Corrected positive score expectation based on library behavior (includes 'job')
      expect(resultsPositive[0].score).toBe(11); 
      expect(resultsNegative[0].score).toBe(-12);
      expect(resultsNeutral[0].score).toBe(0);
      expect(resultsPositive[0].reasoning).toContain('rawScore');
    });

    it('should output category string when outputType is category', async () => {
      const config: SentimentEvaluatorConfig = { 
        criterionName: 'SentimentCategory', 
        outputType: 'category',
        positiveThreshold: 0.1, // Example thresholds for comparative score
        negativeThreshold: -0.1
      };
      const evaluator = new SentimentEvaluator(config);
      
      const resultsPositive = await evaluator.evaluate(createMockInput(positiveText), [mockCriterionCategory]);
      const resultsNegative = await evaluator.evaluate(createMockInput(negativeText), [mockCriterionCategory]);
      const resultsNeutral = await evaluator.evaluate(createMockInput(neutralText), [mockCriterionCategory]);
      
      expect(resultsPositive[0].score).toBe('positive');
      expect(resultsNegative[0].score).toBe('negative');
      expect(resultsNeutral[0].score).toBe('neutral');
      expect(resultsPositive[0].reasoning).toContain('category -> positive');
      expect(resultsNegative[0].reasoning).toContain('category -> negative');
      expect(resultsNeutral[0].reasoning).toContain('category -> neutral');
    });

    it('should handle different sourceTextFields', async () => {
      const config: SentimentEvaluatorConfig = { criterionName: 'SentimentTest', sourceTextField: 'prompt' };
      const evaluator = new SentimentEvaluator(config);
      const input = createMockInput('response is neutral');
      input.prompt = positiveText; // Put positive text in prompt

      const results = await evaluator.evaluate(input, [mockCriterionNumeric]);
      expect(results[0].score).toBeGreaterThan(0.5); // Should evaluate the prompt
      expect(results[0].reasoning).toContain("Sentiment analysis of 'prompt'");
    });
    
    it('should return error result if source field is missing/not string', async () => {
      const config: SentimentEvaluatorConfig = { criterionName: 'SentimentTest' };
      const evaluator = new SentimentEvaluator(config);
      const input = createMockInput({ complex: 'object' } as any);
      const results = await evaluator.evaluate(input, [mockCriterionNumeric]);
      expect(results[0].score).toBe(0); // Default error score for numeric
      expect(results[0].error).toBeDefined();
      expect(results[0].reasoning).toContain("Source text field 'response' did not yield a string");
    });

    it('should return empty result if criterion does not match', async () => {
      const config: SentimentEvaluatorConfig = { criterionName: 'SentimentTest' };
      const evaluator = new SentimentEvaluator(config);
      const input = createMockInput(positiveText, [mockCriterionCategory]); // Pass criteria for different name
      const results = await evaluator.evaluate(input, [mockCriterionCategory]);
      expect(results).toHaveLength(0);
    });
  });

  // TODO: Add tests for core sentiment analysis, output types, field sourcing, etc.

}); 