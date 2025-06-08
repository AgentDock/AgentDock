import { embed, type EmbeddingModel } from 'ai';

import { type Message as AgentMessage } from '../../../../types/messages';
import {
  type EvaluationCriteria,
  type EvaluationInput,
  type EvaluationResult
} from '../../../types';
import {
  NLPAccuracyEvaluator,
  type NLPAccuracyEvaluatorConfig
} from '../accuracy';

// Mock the 'ai' module
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  embed: jest.fn()
}));
const mockEmbed = embed as jest.Mock;

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length)
    return 0;
  let dotProduct = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('NLPAccuracyEvaluator - Input Type Handling', () => {
  let evaluator: NLPAccuracyEvaluator;
  const evaluatorConfig: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticSimilarityInputTest',
    embeddingModel:
      'text-embedding-3-small' as unknown as EmbeddingModel<string>,
    similarityThreshold: 0.8
  };

  beforeEach(() => {
    mockEmbed.mockClear();
    evaluator = new NLPAccuracyEvaluator(evaluatorConfig);
  });

  const mockEmbedding = (text: string): number[] => {
    const arr = Array(10).fill(0);
    if (text === '') return arr;
    for (let i = 0; i < Math.min(text.length, 10); i++) {
      arr[i] = text.charCodeAt(i) / 128 - 0.5;
    }
    const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0 && text.length > 0) return arr.map(() => 0.1);
    if (magnitude === 0) return arr;
    return arr.map((x) => x / (magnitude || 1));
  };

  const createTestInput = (
    response: any,
    groundTruth: any,
    criterionScale: 'binary' | 'numeric' | 'pass/fail' = 'binary'
  ): EvaluationInput => {
    const criteria: EvaluationCriteria[] = [
      {
        name: evaluatorConfig.criterionName,
        description: 'Test criterion for input types',
        scale: criterionScale
      }
    ];
    return {
      response: response as string | AgentMessage,
      groundTruth: groundTruth as string | any,
      criteria
    };
  };

  it('should handle non-string response or groundTruth by stringifying them', async () => {
    const respObj = { key: 'value object' };
    const gtArr = [1, 2, 3];
    const strRespObj = JSON.stringify(respObj);
    const expectedStrGt = String(gtArr);

    mockEmbed
      .mockResolvedValueOnce({
        embedding: mockEmbedding(strRespObj),
        usage: { promptTokens: 1, totalTokens: 1 }
      })
      .mockResolvedValueOnce({
        embedding: mockEmbedding(expectedStrGt),
        usage: { promptTokens: 1, totalTokens: 1 }
      });

    const input = createTestInput(respObj, gtArr);
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];

    const actualSimilarity = cosineSimilarity(
      mockEmbedding(strRespObj),
      mockEmbedding(expectedStrGt)
    );
    expect(result.score).toBe(
      actualSimilarity >= (evaluatorConfig.similarityThreshold || 0)
    );
    expect(result.reasoning).toContain(
      `Cosine similarity: ${actualSimilarity.toFixed(4)}.`
    );

    expect(mockEmbed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: strRespObj })
    );
    expect(mockEmbed).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: expectedStrGt })
    );
  });

  it('should handle EvaluationInput with Message objects (by stringifying them)', async () => {
    const responseMessage: AgentMessage = {
      id: 'test-resp-msg-1',
      role: 'assistant',
      content: 'Message response text',
      createdAt: new Date()
    };
    const groundTruthMessage: AgentMessage = {
      id: 'test-gt-msg-1',
      role: 'user',
      content: 'Message ground truth text',
      createdAt: new Date()
    };

    // The evaluator in accuracy.ts JSON.stringifies the response Message object.
    // For groundTruth, it uses String().
    const strResponseMessage = JSON.stringify(responseMessage);
    const strGroundTruthMessage = String(groundTruthMessage); // Corrected: Use String()

    mockEmbed
      .mockResolvedValueOnce({
        embedding: mockEmbedding(strResponseMessage),
        usage: { promptTokens: 1, totalTokens: 1 }
      })
      .mockResolvedValueOnce({
        embedding: mockEmbedding(strGroundTruthMessage),
        usage: { promptTokens: 1, totalTokens: 1 }
      }); // Use corrected strGroundTruthMessage

    const input = createTestInput(responseMessage, groundTruthMessage);
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];

    // Similarity will be based on the actual string representations used by the evaluator
    const expectedSimilarity = cosineSimilarity(
      mockEmbedding(strResponseMessage),
      mockEmbedding(strGroundTruthMessage)
    );
    expect(result.score).toBe(
      expectedSimilarity >= (evaluatorConfig.similarityThreshold || 0)
    );
    expect(result.reasoning).toContain(
      `Cosine similarity: ${expectedSimilarity.toFixed(4)}.`
    );

    expect(mockEmbed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: strResponseMessage })
    );
    expect(mockEmbed).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: strGroundTruthMessage })
    ); // Expect String(groundTruthMessage)
  });

  it('should produce a similarity of 0 if embeddings are orthogonal', async () => {
    const embeddingA = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Vector A
    const embeddingB = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]; // Vector B (orthogonal to A)

    mockEmbed
      .mockResolvedValueOnce({
        embedding: embeddingA,
        usage: { promptTokens: 1, totalTokens: 1 }
      })
      .mockResolvedValueOnce({
        embedding: embeddingB,
        usage: { promptTokens: 1, totalTokens: 1 }
      });

    // Input texts don't matter as much as the mocked embeddings for this test
    const input = createTestInput(
      'textA produces orthogonal embedding',
      'textB produces other orthogonal embedding'
    );
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false); // Cosine is 0, 0 < threshold (0.8) -> false
    expect(result.reasoning).toContain('Cosine similarity: 0.0000.');
    expect(result.reasoning).toContain(
      `Threshold: ${evaluatorConfig.similarityThreshold}. Outcome: Fail.`
    );
  });
});
