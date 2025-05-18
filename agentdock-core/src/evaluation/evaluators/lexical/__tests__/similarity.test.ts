import { LexicalSimilarityEvaluator, type LexicalSimilarityEvaluatorConfig } from '../similarity';
import type {
  EvaluationInput,
  EvaluationCriteria,
  EvaluationResult,
  AgentMessage,
  TextContent,
  MessageContent,
} from '../../../types';

// Mock helper
const createMockInput = (
  response: string | AgentMessage,
  groundTruth?: string | any,
  context?: Record<string, any>,
  criteria?: EvaluationCriteria[],
): EvaluationInput => {
  let finalResponse: string | AgentMessage;
  if (typeof response === 'object' && 'role' in response && response.role === 'assistant') {
    // It's an AgentMessage
    const agentMsg = response as AgentMessage;
    let contentString = agentMsg.content;
    if (Array.isArray(agentMsg.contentParts) && agentMsg.contentParts.length > 0) {
      const firstTextPart = agentMsg.contentParts.find((p: MessageContent) => p.type === 'text') as
        | TextContent
        | undefined;
      if (firstTextPart && typeof firstTextPart.text === 'string') {
        contentString = firstTextPart.text;
      }
    }
    finalResponse = { ...agentMsg, content: contentString || '' };
  } else {
    finalResponse = response;
  }
  return {
    response: finalResponse,
    groundTruth,
    context,
    criteria: criteria || [{ name: 'LexSim', description: 'Test', scale: 'numeric' }],
  };
};

describe('LexicalSimilarityEvaluator', () => {
  const mockCriterion: EvaluationCriteria = {
    name: 'LexSim',
    description: 'Test lexical similarity',
    scale: 'numeric',
  };

  describe('Constructor Error Handling', () => {
    it('should throw if criterionName is missing', () => {
      const config: Partial<LexicalSimilarityEvaluatorConfig> = {}; // Missing criterionName
      expect(
        () => new LexicalSimilarityEvaluator(config as LexicalSimilarityEvaluatorConfig),
      ).toThrow('[LexicalSimilarityEvaluator] criterionName must be provided and non-empty.');
    });

    it('should throw if criterionName is empty', () => {
      const config: LexicalSimilarityEvaluatorConfig = { criterionName: ' ' };
      expect(() => new LexicalSimilarityEvaluator(config)).toThrow(
        '[LexicalSimilarityEvaluator] criterionName must be provided and non-empty.',
      );
    });
  });

  describe('Core Functionality (Sorensen-Dice Default)', () => {
    const config: LexicalSimilarityEvaluatorConfig = { criterionName: 'LexSim' }; // Default algorithm
    const evaluator = new LexicalSimilarityEvaluator(config);

    it('should return score 1 for perfect match', async () => {
      const input = createMockInput('hello world', 'hello world');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain('Sørensen-Dice');
    });

    it('should return score 0 for complete mismatch', async () => {
      const input = createMockInput('abc', 'xyz');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(0);
    });

    it('should return partial score for partial match', async () => {
      const input = createMockInput('abcde', 'abcfg');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(0.6);
    });

    it('should be case-insensitive by default', async () => {
      const input = createMockInput('HELLO world', 'hello WORLD');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
    });

    it('should be case-sensitive when configured', async () => {
      const caseSensitiveConfig: LexicalSimilarityEvaluatorConfig = {
        ...config,
        caseSensitive: true,
      };
      const caseSensitiveEvaluator = new LexicalSimilarityEvaluator(caseSensitiveConfig);
      const input = createMockInput('Hello World', 'hello world');
      const results = await caseSensitiveEvaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeLessThan(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should normalize whitespace by default', async () => {
      const input = createMockInput('  hello   world  ', 'hello world');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
    });

    it('should NOT normalize whitespace when configured', async () => {
      const noNormalizeConfig: LexicalSimilarityEvaluatorConfig = {
        ...config,
        normalizeWhitespace: false,
      };
      const noNormalizeEvaluator = new LexicalSimilarityEvaluator(noNormalizeConfig);
      const input = createMockInput('hello\nworld', 'hello world');
      const results = await noNormalizeEvaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeLessThan(1);
    });
  });

  describe('Algorithm Selection', () => {
    it.skip('should use Jaro-Winkler when configured', async () => {
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        algorithm: 'jaro-winkler',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput('martha', 'marhta');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].reasoning).toContain('Jaro-Winkler');
      expect(results[0].score).toBeCloseTo(0.961, 3);
    });

    it('should use Levenshtein when configured (normalized)', async () => {
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        algorithm: 'levenshtein',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput('kitten', 'sitting');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].reasoning).toContain('Levenshtein');
      expect(results[0].score).toBeCloseTo(1 - 3 / 7, 3);
    });
  });

  describe('Field Sourcing and Error Handling', () => {
    it('should use response/groundTruth by default', async () => {
      const config: LexicalSimilarityEvaluatorConfig = { criterionName: 'LexSim' }; // Defaults
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput('response text', 'response text');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain("Comparing 'response' with 'groundTruth'");
    });

    it('should use prompt as sourceField when configured', async () => {
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        sourceField: 'prompt', // Use prompt as source
        referenceField: 'groundTruth',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput('response text', 'prompt text');
      input.prompt = 'prompt text'; // Add prompt to input

      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain("Comparing 'prompt' with 'groundTruth'");
    });

    it('should use context as sourceField and response (AgentMessage) as referenceField', async () => {
      const agentResponse: AgentMessage = {
        id: 'ar1',
        role: 'assistant',
        content: 'context text match',
        contentParts: [{ type: 'text', text: 'context text match' }],
        createdAt: new Date(),
      };
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        sourceField: 'context.data.source',
        referenceField: 'response',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput(agentResponse, 'some groundtruth', {
        data: { source: 'context text match' },
      });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      // console.log('DEBUGGING similarity.test.ts - results[0].reasoning:', results[0].reasoning); // Keep this commented out
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain("Comparing 'context.data.source' with 'response'");
    });

    it('should use response (string) as source and context as referenceField', async () => {
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        sourceField: 'response',
        referenceField: 'context.data.ref',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput('match me', 'some groundtruth', { data: { ref: 'match me' } });
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain("Comparing 'response' with 'context.data.ref'");
    });

    it('should use groundTruth.path as source and prompt.path as reference (if supported by getInputText)', async () => {
      // This tests if getInputText can handle deep paths for prompt if prompt were an object.
      // Currently, input.prompt is typically a string, so prompt.path wouldn't work unless prompt itself becomes structured.
      // We will test groundTruth.path as source and a simple prompt string as reference.
      const config: LexicalSimilarityEvaluatorConfig = {
        criterionName: 'LexSim',
        sourceField: 'groundTruth.textValue',
        referenceField: 'prompt',
      };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput(
        'some response',
        { textValue: 'gt text' }, // groundTruth is an object
        {},
        [mockCriterion],
      );
      input.prompt = 'gt text';

      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBeCloseTo(1);
      expect(results[0].reasoning).toContain("Comparing 'groundTruth.textValue' with 'prompt'");
    });

    it('should return error result if sourceField (response) is missing/not string', async () => {
      const config: LexicalSimilarityEvaluatorConfig = { criterionName: 'LexSim' };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput(
        { complex: 'object' } as any, // Source field (response) is wrong type
        'expected text',
      );
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(0);
      expect(results[0].error).toBeDefined();
      expect(results[0].reasoning).toContain(
        "Source text (from 'response') or reference text (from 'groundTruth') could not be extracted",
      );
      expect(results[0].reasoning).toContain('Source undefined: true');
    });

    it('should return error result if referenceField (groundTruth) is missing/not string', async () => {
      const config: LexicalSimilarityEvaluatorConfig = { criterionName: 'LexSim' };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const input = createMockInput(
        'actual text', // Source field is ok
        undefined, // Reference field (groundTruth) is missing
      );
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(0);
      expect(results[0].error).toBeDefined();
      expect(results[0].reasoning).toContain(
        "Source text (from 'response') or reference text (from 'groundTruth') could not be extracted",
      );
      expect(results[0].reasoning).toContain('Reference undefined: true');
    });

    it('should return empty array if criterion is not in input.criteria', async () => {
      const config: LexicalSimilarityEvaluatorConfig = { criterionName: 'LexSim' };
      const evaluator = new LexicalSimilarityEvaluator(config);
      const otherCriterion: EvaluationCriteria = {
        name: 'Other',
        description: '',
        scale: 'binary',
      };
      const input = createMockInput('hello', 'hello', {}, [otherCriterion]);
      const results = await evaluator.evaluate(input, [otherCriterion]);
      expect(results).toHaveLength(0);
    });
  });

  // TODO: Add tests for other algorithms, field sourcing, etc.
});
