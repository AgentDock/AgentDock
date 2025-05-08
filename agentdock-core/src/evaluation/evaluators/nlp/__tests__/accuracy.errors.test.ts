import { NLPAccuracyEvaluator, type NLPAccuracyEvaluatorConfig } from '../accuracy';
import { type EvaluationResult, type EvaluationInput, type EvaluationCriteria } from '../../../types';
import { type Message as AgentMessage } from '../../../../types/messages';
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

describe('NLPAccuracyEvaluator - Error Handling', () => {
  let evaluator: NLPAccuracyEvaluator;
  const evaluatorConfig: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticSimilarityErrorTest',
    embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
    similarityThreshold: 0.8,
  };

  beforeEach(() => {
    mockEmbed.mockClear();
    evaluator = new NLPAccuracyEvaluator(evaluatorConfig);
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
    response: string | AgentMessage,
    groundTruth: string | AgentMessage,
    criterionScale: 'binary' | 'numeric' | 'pass/fail' = 'binary'
  ): EvaluationInput => {
    const criteria: EvaluationCriteria[] = [{
      name: evaluatorConfig.criterionName,
      description: 'Test criterion for error handling',
      scale: criterionScale,
    }];
    return {
      response,
      groundTruth,
      criteria,
    };
  };

  it('should handle embedding generation failure for response', async () => {
    const errorMsg = 'Embedding API error for response';
    mockEmbed.mockRejectedValueOnce(new Error(errorMsg));
    mockEmbed.mockResolvedValueOnce({ embedding: mockEmbedding('Ground truth.'), usage: { promptTokens: 1, totalTokens: 1 } });

    const input = createTestInput('Some response.', 'Ground truth.');
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(input.criteria![0].scale === 'binary' ? false : 0);
    expect(result.reasoning).toContain(errorMsg);
    expect(result.error).toContain(errorMsg);
    expect(mockEmbed).toHaveBeenCalledTimes(2);
  });

  it('should handle embedding generation failure for groundTruth', async () => {
    const errorMsg = 'Embedding API error for groundTruth';
    mockEmbed
      .mockResolvedValueOnce({ embedding: mockEmbedding('Some response.'), usage: { promptTokens: 1, totalTokens: 1 } })
      .mockRejectedValueOnce(new Error(errorMsg));

    const input = createTestInput('Some response.', 'Ground truth.');
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(input.criteria![0].scale === 'binary' ? false : 0);
    expect(result.reasoning).toContain(errorMsg);
    expect(result.error).toContain(errorMsg);
    expect(mockEmbed).toHaveBeenCalledTimes(2); // Both embed calls attempted
  });

  it('should return empty results if configured criterionName is not in input criteria', async () => {
    const wrongCriterionNameConfig: NLPAccuracyEvaluatorConfig = {
      ...evaluatorConfig,
      criterionName: 'NonExistentCriterionName',
    };
    evaluator = new NLPAccuracyEvaluator(wrongCriterionNameConfig);
    
    const input = createTestInput('response', 'groundtruth'); // input.criteria will have 'SemanticSimilarityErrorTest'
    
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results).toHaveLength(0); // As per accuracy.ts logic, returns empty array
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  describe('Constructor Error Handling', () => {
    const validModel = 'text-embedding-3-small' as unknown as EmbeddingModel<string>;

    it('should throw error if criterionName is missing in config', () => {
      const configWithoutCriterionName: Partial<NLPAccuracyEvaluatorConfig> = {
        embeddingModel: validModel,
        similarityThreshold: 0.8,
      };
      expect(() => new NLPAccuracyEvaluator(configWithoutCriterionName as NLPAccuracyEvaluatorConfig))
        .toThrow('[NLPAccuracyEvaluator] criterionName must be a non-empty string.');
    });

    it('should throw error if criterionName is an empty string in config', () => {
      const configWithEmptyCriterionName: NLPAccuracyEvaluatorConfig = {
        criterionName: '',
        embeddingModel: validModel,
        similarityThreshold: 0.8,
      };
      expect(() => new NLPAccuracyEvaluator(configWithEmptyCriterionName))
        .toThrow('[NLPAccuracyEvaluator] criterionName must be a non-empty string.');
    });

    it('should throw error if embeddingModel is missing in config', () => {
      const configWithoutModel: Partial<NLPAccuracyEvaluatorConfig> = {
        criterionName: 'TestCriterion',
        similarityThreshold: 0.8,
      };
      // Need to cast to NLPAccuracyEvaluatorConfig to satisfy the constructor's type, 
      // even though we are intentionally making it invalid for the test.
      expect(() => new NLPAccuracyEvaluator(configWithoutModel as NLPAccuracyEvaluatorConfig))
        .toThrow('[NLPAccuracyEvaluator] embeddingModel must be provided.');
    });
  });
}); 