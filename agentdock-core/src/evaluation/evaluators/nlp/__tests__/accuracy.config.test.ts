import { NLPAccuracyEvaluator, type NLPAccuracyEvaluatorConfig } from '../accuracy';
import { type EvaluationResult, type EvaluationInput, type EvaluationCriteria } from '../../../types';
import { type Message } from '../../../../types/messages';
import { embed, type EmbeddingModel } from 'ai';

// Mock the 'ai' module
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  embed: jest.fn(),
}));
const mockEmbed = embed as jest.Mock;

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('NLPAccuracyEvaluator - Configuration Options', () => {
  let evaluator: NLPAccuracyEvaluator;
  // Base config for most tests in this file
  const baseEvalConfig: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticSimilarityConfigTest',
    embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
    similarityThreshold: 0.8,
  };

  beforeEach(() => {
    mockEmbed.mockClear();
    // Default evaluator for most tests, can be overridden in specific tests
    evaluator = new NLPAccuracyEvaluator(baseEvalConfig);
  });

  const mockEmbedding = (text: string): number[] => {
    const arr = Array(10).fill(0);
    if (text === '') return arr;
    for (let i = 0; i < Math.min(text.length, 10); i++) {
      arr[i] = (text.charCodeAt(i) / 128) - 0.5;
    }
    const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0 && text.length > 0) return arr.map(() => 0.1);
    if (magnitude === 0) return arr;
    return arr.map(x => x / (magnitude || 1));
  };

  const createTestInput = (
    response: string | Message,
    groundTruth: string | Message,
    criterionName: string = baseEvalConfig.criterionName,
    criterionScale: 'binary' | 'numeric' | 'pass/fail' = 'binary'
  ): EvaluationInput => {
    const criteria: EvaluationCriteria[] = [{
      name: criterionName,
      description: 'Test criterion for config tests',
      scale: criterionScale,
    }];
    return {
      response,
      groundTruth,
      criteria,
    };
  };

  it('should use custom embeddingModel if provided in config', async () => {
    const customModelId = 'custom-embedding-model-xyz';
    const configWithCustomModel: NLPAccuracyEvaluatorConfig = {
      criterionName: 'CustomModelCriterion',
      embeddingModel: customModelId as unknown as EmbeddingModel<string>,
      similarityThreshold: 0.7,
    };
    evaluator = new NLPAccuracyEvaluator(configWithCustomModel); // Re-initialize with custom config
    
    const respText = 'response text';
    const gtText = 'ground truth text';
    mockEmbed
      .mockResolvedValueOnce({ embedding: mockEmbedding(respText), usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: mockEmbedding(gtText), usage: { promptTokens: 1, totalTokens: 1 } });

    // Ensure the input criterion matches the evaluator's configured criterionName
    const input = createTestInput(respText, gtText, configWithCustomModel.criterionName);
    
    await evaluator.evaluate(input, input.criteria!);
    
    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        model: customModelId,
        value: respText,
      }),
    );
    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        model: customModelId,
        value: gtText,
      }),
    );
  });

  it('should correctly apply different thresholds (for binary scale)', async () => {
    const respText = 'text for threshold test';
    const gtText = 'another text for threshold test';
    
    // Mock embeddings to produce a known similarity, e.g., 0.7
    const vecProducing07_1 = [1,0,0,0,0,0,0,0,0,0]; // Arbitrary vector
    const vecProducing07_2 = [0.7, Math.sqrt(1 - 0.7*0.7), 0,0,0,0,0,0,0,0]; // Results in cosine of 0.7 with vec1

    // Config with a low threshold (0.5) - similarity 0.7 should pass
    const configLowThreshold: NLPAccuracyEvaluatorConfig = {
      ...baseEvalConfig,
      similarityThreshold: 0.5,
    };
    evaluator = new NLPAccuracyEvaluator(configLowThreshold);
    
    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding: vecProducing07_1, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: vecProducing07_2, usage: { promptTokens: 1, totalTokens: 1 } });

    let input = createTestInput(respText, gtText, baseEvalConfig.criterionName, 'binary');
    let results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(true); // Similarity 0.7 is >= 0.5 -> Pass
    expect(results[0].reasoning).toContain('Cosine similarity: 0.7000.');
    expect(results[0].reasoning).toContain(`Threshold: ${configLowThreshold.similarityThreshold}. Outcome: Pass.`);

    // Config with a high threshold (0.95) - similarity 0.7 should fail
    const configHighThreshold: NLPAccuracyEvaluatorConfig = {
      ...baseEvalConfig,
      similarityThreshold: 0.95,
    };
    evaluator = new NLPAccuracyEvaluator(configHighThreshold);

    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding: vecProducing07_1, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: vecProducing07_2, usage: { promptTokens: 1, totalTokens: 1 } });
    
    input = createTestInput(respText, gtText, baseEvalConfig.criterionName, 'binary'); // Recreate input if needed, or ensure criteria name matches
    results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(false); // Similarity 0.7 is < 0.95 -> Fail
    expect(results[0].reasoning).toContain('Cosine similarity: 0.7000.');
    expect(results[0].reasoning).toContain(`Threshold: ${configHighThreshold.similarityThreshold}. Outcome: Fail.`);
  });

  it('should use the criterionName from its config in the EvaluationResult', async () => {
    const specificCriterionName = 'TestCriterionNameFromConfig';
    const configWithSpecificName: NLPAccuracyEvaluatorConfig = {
      ...baseEvalConfig,
      criterionName: specificCriterionName,
    };
    evaluator = new NLPAccuracyEvaluator(configWithSpecificName);

    const respText = 'response for name test';
    const gtText = 'ground truth for name test';
    mockEmbed
      .mockResolvedValueOnce({ embedding: mockEmbedding(respText), usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: mockEmbedding(gtText), usage: { promptTokens: 1, totalTokens: 1 } });

    // Input criterionName must match the evaluator's configured criterionName for it to be picked up
    const input = createTestInput(respText, gtText, specificCriterionName);
    const results = await evaluator.evaluate(input, input.criteria!);

    expect(results.length).toBe(1);
    expect(results[0].criterionName).toBe(specificCriterionName);
  });

  it('should output raw similarity score and mention threshold when scale is numeric', async () => {
    const numericScaleCriterion = 'NumericSimilarityTest';
    const numericConfig: NLPAccuracyEvaluatorConfig = {
      criterionName: numericScaleCriterion,
      embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
      similarityThreshold: 0.75, // A threshold
    };
    evaluator = new NLPAccuracyEvaluator(numericConfig);

    const respText = 'numeric response';
    const gtText = 'numeric ground truth';
    
    // Mock embeddings to produce a known similarity, e.g., 0.85
    const vecProducing085_1 = [1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0].map(v => v / Math.sqrt(1 + 0.5*0.5)); // Normalized
    const vecProducing085_2 = [0.85, Math.sqrt(1 - 0.85*0.85) * (vecProducing085_1[1] > 0 ? 1 : -1) * 0.5 + vecProducing085_1[1], 0,0,0,0,0,0,0,0]; 
    // A more complex way to try and get a different vector that has ~0.85 similarity
    // For simplicity in example, let's use a direct mock for similarity calculation
    // The actual cosineSimilarity function will be used by the evaluator.
    // We mock the embeddings that would result in a desired similarity.
    const mockRespEmbedding = mockEmbedding(respText); // Doesn't matter what these are if we expect raw similarity
    const mockGtEmbedding = mockEmbedding(gtText); // Let's target similarity of ~0.888
    
    // Let's make one vector fixed and derive the other for a clear similarity for the test
    const fixedVec = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(v => v / Math.sqrt(3.85)); // Normalized
    // To get similarity S with fixedVec (normalized), another normalized vector 'derivedVec'
    // must satisfy dot(fixedVec, derivedVec) = S.
    // For simplicity in this mock setup, we'll just ensure the cosineSimilarity function inside evaluates to something.
    // The key is what the evaluator *does* with that similarity.
    // We'll mock embed to return specific vectors that we know the similarity of.
    // Example: vecA = [1,0,...], vecB = [0.88, sqrt(1-0.88^2), ...] similarity = 0.88

    const testVecA = [1,0,0,0,0,0,0,0,0,0];
    const targetSimilarity = 0.88;
    const testVecB = [targetSimilarity, Math.sqrt(1 - targetSimilarity*targetSimilarity), 0,0,0,0,0,0,0,0];


    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding: testVecA, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: testVecB, usage: { promptTokens: 1, totalTokens: 1 } });

    const input = createTestInput(respText, gtText, numericScaleCriterion, 'numeric');
    const results = await evaluator.evaluate(input, input.criteria!);

    expect(results.length).toBe(1);
    expect(results[0].criterionName).toBe(numericScaleCriterion);
    const expectedSimilarity = cosineSimilarity(testVecA, testVecB);
    expect(results[0].score).toBeCloseTo(expectedSimilarity); 
    expect(results[0].reasoning).toContain(`Cosine similarity: ${expectedSimilarity.toFixed(4)}.`);
    expect(results[0].reasoning).toContain(
      `(Note: similarityThreshold is set but criterion scale is 'numeric', not binary/pass-fail. Threshold not directly applied for scoring boolean pass/fail unless scale matches.)`
    );
  });

  describe('NLPAccuracyEvaluator - similarityThreshold Edge Cases', () => {
    const criterionName = 'ThresholdEdgeCaseTest';
    const respText = 'response for threshold edge cases';
    const gtText = 'ground truth for threshold edge cases';
    
    // Mock embeddings to produce a known similarity, e.g., 0.6 (below typical thresholds)
    const vecA_sim06 = [1,0,0,0,0,0,0,0,0,0]; 
    const vecB_sim06 = [0.6, Math.sqrt(1 - 0.6*0.6), 0,0,0,0,0,0,0,0];
    const expectedSimilarity06 = cosineSimilarity(vecA_sim06, vecB_sim06); // Should be 0.6

    // Mock embeddings to produce a known similarity, e.g., 0.9 (above typical thresholds)
    const vecA_sim09 = [1,0,0,0,0,0,0,0,0,0]; 
    const vecB_sim09 = [0.9, Math.sqrt(1 - 0.9*0.9), 0,0,0,0,0,0,0,0];
    const expectedSimilarity09 = cosineSimilarity(vecA_sim09, vecB_sim09); // Should be 0.9

    beforeEach(() => {
      mockEmbed.mockClear();
    });

    it('should output raw similarity for binary scale if similarityThreshold is undefined in config', async () => {
      const configNoThreshold: NLPAccuracyEvaluatorConfig = {
        criterionName,
        embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
        // similarityThreshold is undefined
      };
      evaluator = new NLPAccuracyEvaluator(configNoThreshold);

      mockEmbed
        .mockResolvedValueOnce({ embedding: vecA_sim06, usage: { promptTokens: 1, totalTokens: 1 } })
        .mockResolvedValueOnce({ embedding: vecB_sim06, usage: { promptTokens: 1, totalTokens: 1 } });

      const input = createTestInput(respText, gtText, criterionName, 'binary');
      const results = await evaluator.evaluate(input, input.criteria!);
      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(expectedSimilarity06); // Raw similarity
      expect(results[0].reasoning).toContain(`Cosine similarity: ${expectedSimilarity06.toFixed(4)}.`);
      expect(results[0].reasoning).not.toContain('Threshold:');
      expect(results[0].reasoning).not.toContain('Outcome:');
    });

    it('should output raw similarity for numeric scale if similarityThreshold is undefined in config', async () => {
      const configNoThreshold: NLPAccuracyEvaluatorConfig = {
        criterionName,
        embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
      };
      evaluator = new NLPAccuracyEvaluator(configNoThreshold);

      mockEmbed
        .mockResolvedValueOnce({ embedding: vecA_sim09, usage: { promptTokens: 1, totalTokens: 1 } })
        .mockResolvedValueOnce({ embedding: vecB_sim09, usage: { promptTokens: 1, totalTokens: 1 } });

      const input = createTestInput(respText, gtText, criterionName, 'numeric');
      const results = await evaluator.evaluate(input, input.criteria!);
      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(expectedSimilarity09);
      expect(results[0].reasoning).toContain(`Cosine similarity: ${expectedSimilarity09.toFixed(4)}.`);
      // As per accuracy.ts, if scale is not binary/pass-fail, it won't include threshold application in reasoning this way.
      // It *might* mention "similarityThreshold is set but criterion scale is 'numeric'" if threshold *was* set.
      // If threshold is NOT set, this part of reasoning is also skipped.
      expect(results[0].reasoning).not.toContain('(Note: similarityThreshold is set but criterion scale is \'numeric\')');
    });

    it('should output raw similarity for binary scale if similarityThreshold is null in config', async () => {
      const configNullThreshold: NLPAccuracyEvaluatorConfig = {
        criterionName,
        embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
        similarityThreshold: null,
      };
      evaluator = new NLPAccuracyEvaluator(configNullThreshold);

      mockEmbed
        .mockResolvedValueOnce({ embedding: vecA_sim06, usage: { promptTokens: 1, totalTokens: 1 } })
        .mockResolvedValueOnce({ embedding: vecB_sim06, usage: { promptTokens: 1, totalTokens: 1 } });

      const input = createTestInput(respText, gtText, criterionName, 'binary');
      const results = await evaluator.evaluate(input, input.criteria!);
      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(expectedSimilarity06); // Raw similarity
      expect(results[0].reasoning).toContain(`Cosine similarity: ${expectedSimilarity06.toFixed(4)}.`);
      expect(results[0].reasoning).not.toContain('Threshold:');
      expect(results[0].reasoning).not.toContain('Outcome:');
    });
  });
}); 