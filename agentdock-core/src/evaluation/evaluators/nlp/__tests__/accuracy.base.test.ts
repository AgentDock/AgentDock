import { NLPAccuracyEvaluator, type NLPAccuracyEvaluatorConfig } from '../accuracy';
import { type EvaluationResult, type EvaluationInput, type EvaluationCriteria, type AgentMessage } from '../../../types';
import { embed, type EmbeddingModel } from 'ai'; // Ensure EmbeddingModel is imported

// Mock the 'ai' module for the embed function
jest.mock('ai', () => ({
  ...jest.requireActual('ai'), // Import and retain default exports
  embed: jest.fn(),
}));

// Cast the mock to the correct type
const mockEmbed = embed as jest.Mock;

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    // If both norms are 0 (e.g. two zero vectors), they are identical for similarity purposes.
    // However, division by zero. Most libraries return 0 or 1.
    // The original evaluator's cosineSimilarity returns 0 here.
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('NLPAccuracyEvaluator - Base Functionality', () => {
  let evaluator: NLPAccuracyEvaluator;

  // This config strictly matches the NLPAccuracyEvaluatorConfig from '../accuracy.ts'
  const evaluatorConfigForConstructor: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticSimilarityTest',
    embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>, // Use type assertion via unknown
    similarityThreshold: 0.8,
  };

  beforeEach(() => {
    mockEmbed.mockClear();
    evaluator = new NLPAccuracyEvaluator(evaluatorConfigForConstructor);
  });

  // Simplified mockEmbedding for tests
  const mockEmbedding = (text: string): number[] => {
    const arr = Array(10).fill(0);
    if (text === '') return arr;
    for (let i = 0; i < Math.min(text.length, 10); i++) {
      arr[i] = (text.charCodeAt(i) / 128) - 0.5; // char code based
    }
    const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0 && text.length > 0) return arr.map(() => 0.1); // Avoid all-zero for non-empty
    if (magnitude === 0) return arr;
    return arr.map(x => x / (magnitude || 1)); // Normalize
  };

  // Helper to create EvaluationInput
  const createTestInput = (
    response: string | AgentMessage,
    groundTruth: string | AgentMessage | undefined,
    criterionScale: 'binary' | 'numeric' | 'pass/fail' = 'numeric'
  ): EvaluationInput => {
    const criteria: EvaluationCriteria[] = [{
      name: evaluatorConfigForConstructor.criterionName, // Match evaluator's configured name
      description: 'Test criterion for semantic similarity',
      scale: criterionScale,
    }];
    return {
      response,
      groundTruth,
      criteria, // Pass the defined criteria
    };
  };

  it('should correctly calculate score when similarity is above threshold (numeric scale)', async () => {
    const respText = 'This is the response text.';
    const gtText = 'This is the ground truth text that is very similar.'; // Made more similar
    
    const embeddingResp = mockEmbedding(respText);
    // Create a highly similar embedding for ground truth
    const embeddingGtHighlySimilar = [...embeddingResp];
    embeddingGtHighlySimilar[0] += 0.001; // Tiny difference

    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingResp, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingGtHighlySimilar, usage: { promptTokens: 1, totalTokens: 1 } });

    const input = createTestInput(respText, gtText, 'numeric');
    const results = await evaluator.evaluate(input, input.criteria!); // Pass both arguments
    
    expect(results.length).toBe(1);
    const result = results[0];
    const expectedSimilarity = cosineSimilarity(embeddingResp, embeddingGtHighlySimilar);
    
    expect(result.score).toBeCloseTo(expectedSimilarity);
    // For numeric scale, the reasoning should contain the similarity and a note about the threshold if set.
    expect(result.reasoning).toContain(`Cosine similarity: ${expectedSimilarity.toFixed(4)}.`);
    if (evaluatorConfigForConstructor.similarityThreshold) {
      expect(result.reasoning).toContain(`(Note: similarityThreshold is set but criterion scale is '${input.criteria![0].scale}'`);
    }
    expect(mockEmbed).toHaveBeenCalledTimes(2);
  });

  it('should correctly score (false for binary, raw for numeric) when similarity is below threshold', async () => {
    // Define explicitly orthogonal vectors to guarantee similarity is 0 (or close to 0)
    const embeddingResp = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Vector A (normalized)
    const embeddingGt =   [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]; // Vector B (normalized and orthogonal to A)
    const respText = 'Text producing vector A'; // Text value doesn't matter now
    const gtText = 'Text producing vector B';   // Text value doesn't matter now

    const expectedLowSimilarity = cosineSimilarity(embeddingResp, embeddingGt); // Should be 0
    expect(expectedLowSimilarity).toBeLessThan(evaluatorConfigForConstructor.similarityThreshold!); // 0 < 0.8, should pass

    // Test with numeric scale
    mockEmbed.mockClear(); // Clear for new set of calls
    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingResp, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingGt, usage: { promptTokens: 1, totalTokens: 1 } });
    
    const inputNumeric = createTestInput(respText, gtText, 'numeric');
    let results = await evaluator.evaluate(inputNumeric, inputNumeric.criteria!);
    expect(results.length).toBe(1);
    let resultNumeric = results[0];
    expect(resultNumeric.score).toBeCloseTo(expectedLowSimilarity);
    expect(resultNumeric.reasoning).toContain(`Cosine similarity: ${expectedLowSimilarity.toFixed(4)}.`);

    // Test with binary scale
    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingResp, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingGt, usage: { promptTokens: 1, totalTokens: 1 } });

    const inputBinary = createTestInput(respText, gtText, 'binary');
    results = await evaluator.evaluate(inputBinary, inputBinary.criteria!);
    expect(results.length).toBe(1);
    let resultBinary = results[0];
    expect(resultBinary.score).toBe(false); // similarity < threshold -> false
    expect(resultBinary.reasoning).toContain(`Cosine similarity: ${expectedLowSimilarity.toFixed(4)}.`);
    expect(resultBinary.reasoning).toContain(`Threshold: ${evaluatorConfigForConstructor.similarityThreshold}. Outcome: Fail.`);
    
    expect(mockEmbed).toHaveBeenCalledTimes(2); // Called twice for the binary part
  });

  it('should handle identical texts resulting in perfect similarity (score 1 for numeric, true for binary)', async () => {
    const text = 'Identical text for response and ground truth.';
    const embedding = mockEmbedding(text); // Should be a non-zero vector if text is non-empty

    // Test with numeric scale
    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding, usage: { promptTokens: 1, totalTokens: 1 } });

    const inputNumeric = createTestInput(text, text, 'numeric');
    let results = await evaluator.evaluate(inputNumeric, inputNumeric.criteria!);
    expect(results.length).toBe(1);
    // cosineSimilarity of a vector with itself should be 1 (if not zero vector)
    expect(results[0].score).toBeCloseTo(1); 
    expect(results[0].reasoning).toContain('Cosine similarity: 1.0000.');

    // Test with binary scale
    mockEmbed.mockClear();
    mockEmbed
      .mockResolvedValueOnce({ embedding, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding, usage: { promptTokens: 1, totalTokens: 1 } });
    
    const inputBinary = createTestInput(text, text, 'binary');
    results = await evaluator.evaluate(inputBinary, inputBinary.criteria!);
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(true); // 1.0 >= threshold (0.8) -> true
    expect(results[0].reasoning).toContain('Outcome: Pass.');
    
    expect(mockEmbed).toHaveBeenCalledTimes(2); // Called twice for the binary part
  });
}); 