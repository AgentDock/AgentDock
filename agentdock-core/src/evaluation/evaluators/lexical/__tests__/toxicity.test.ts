import type {
  AgentMessage,
  EvaluationCriteria,
  EvaluationInput,
  EvaluationResult,
  MessageContent,
  TextContent
} from '../../../types';
import { ToxicityEvaluator, type ToxicityEvaluatorConfig } from '../toxicity';

// Mock helper
const createMockInput = (
  response: string | AgentMessage,
  criteria?: EvaluationCriteria[]
): EvaluationInput => {
  let finalResponse: string | AgentMessage;
  if (
    typeof response === 'object' &&
    'role' in response &&
    response.role === 'assistant'
  ) {
    // It's an AgentMessage
    const agentMsg = response as AgentMessage;
    let contentString = agentMsg.content; // Assume content is already a string or correctly set
    // Ensure contentParts is an array before trying to find in it
    if (
      Array.isArray(agentMsg.contentParts) &&
      agentMsg.contentParts.length > 0
    ) {
      const firstTextPart = agentMsg.contentParts.find(
        (p: MessageContent) => p.type === 'text'
      ) as TextContent | undefined;
      if (firstTextPart && typeof firstTextPart.text === 'string') {
        contentString = firstTextPart.text;
      }
    }
    // If contentString is still not set (e.g. no text parts, or content wasn't a string initially),
    // default to empty string for the content field.
    finalResponse = { ...agentMsg, content: contentString || '' };
  } else {
    finalResponse = response; // It's already a string or not the specific AgentMessage structure we need to adjust
  }
  return {
    response: finalResponse,
    criteria: criteria || [
      { name: 'ToxicityCheck', description: 'Test', scale: 'binary' }
    ]
  };
};

describe('ToxicityEvaluator', () => {
  const mockCriterion: EvaluationCriteria = {
    name: 'ToxicityCheck',
    description: 'Test toxicity',
    scale: 'binary'
  };

  describe('Constructor Error Handling', () => {
    it('should throw if criterionName is missing', () => {
      const config: Partial<ToxicityEvaluatorConfig> = {
        toxicTerms: ['badword']
      };
      expect(
        () => new ToxicityEvaluator(config as ToxicityEvaluatorConfig)
      ).toThrow(
        '[ToxicityEvaluator] criterionName must be provided and non-empty.'
      );
    });

    it('should throw if criterionName is empty', () => {
      const config: Partial<ToxicityEvaluatorConfig> = {
        criterionName: ' ',
        toxicTerms: ['badword']
      };
      expect(
        () => new ToxicityEvaluator(config as ToxicityEvaluatorConfig)
      ).toThrow(
        '[ToxicityEvaluator] criterionName must be provided and non-empty.'
      );
    });

    it('should throw if toxicTerms is missing or empty', () => {
      const config1: Partial<ToxicityEvaluatorConfig> = {
        criterionName: 'Test'
      }; // Missing toxicTerms
      const config2: ToxicityEvaluatorConfig = {
        criterionName: 'Test',
        toxicTerms: []
      }; // Empty toxicTerms

      expect(
        () => new ToxicityEvaluator(config1 as ToxicityEvaluatorConfig)
      ).toThrow(
        '[ToxicityEvaluator] toxicTerms array must be provided and non-empty.'
      );
      expect(() => new ToxicityEvaluator(config2)).toThrow(
        '[ToxicityEvaluator] toxicTerms array must be provided and non-empty.'
      );
    });
  });

  describe('Core Toxicity Checks', () => {
    const toxicTerms = ['darn', 'heck', 'badword'];
    const config: ToxicityEvaluatorConfig = {
      criterionName: 'ToxicityCheck',
      toxicTerms
    };
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
      expect(results[0].metadata?.foundToxicTerms).toEqual(
        expect.arrayContaining(['darn', 'heck'])
      );
      expect(results[0].metadata?.foundToxicTerms).toHaveLength(2);
    });

    it('should be case-insensitive by default', async () => {
      const input = createMockInput('What the HECK is going on?');
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['heck']);
    });

    it('should be case-sensitive when configured', async () => {
      const caseSensitiveConfig: ToxicityEvaluatorConfig = {
        ...config,
        caseSensitive: true
      };
      const caseSensitiveEvaluator = new ToxicityEvaluator(caseSensitiveConfig);
      const input = createMockInput('What the HECK is going on, darn it?'); // Only 'darn' matches case
      const results = await caseSensitiveEvaluator.evaluate(input, [
        mockCriterion
      ]);
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
      const results = await evaluatorSpecial.evaluate(
        createMockInput(inputText),
        [mockCriterion]
      );
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toHaveLength(4);
      expect(results[0].metadata?.foundToxicTerms).toEqual(
        expect.arrayContaining(specialTerms)
      );
    });

    it('should handle different sourceTextFields', async () => {
      const configPrompt: ToxicityEvaluatorConfig = {
        ...config,
        sourceTextField: 'prompt'
      };
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
      expect(results[0].reasoning).toContain(
        "Source text field 'response' did not yield a string"
      );
    });

    it('should return empty result if criterion does not match', async () => {
      const evaluator = new ToxicityEvaluator(config);
      const otherCriterion: EvaluationCriteria = {
        name: 'Other',
        description: '',
        scale: 'binary'
      };
      const input = createMockInput('clean response', [otherCriterion]);
      const results = await evaluator.evaluate(input, [otherCriterion]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Advanced Field Sourcing', () => {
    const toxicTerms = ['darn', 'heck'];
    const mockCriterion: EvaluationCriteria = {
      name: 'ToxicityCheck',
      description: 'Test',
      scale: 'binary'
    };

    it('should source text from groundTruth (string) via sourceTextField', async () => {
      const config: ToxicityEvaluatorConfig = {
        criterionName: 'ToxicityCheck',
        toxicTerms,
        sourceTextField: 'groundTruth'
      };
      const evaluator = new ToxicityEvaluator(config);
      const input = createMockInput('Clean response.');
      input.groundTruth = 'This groundTruth is darn bad.';
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['darn']);
    });

    it('should source text from context (nested path) via sourceTextField', async () => {
      const config: ToxicityEvaluatorConfig = {
        criterionName: 'ToxicityCheck',
        toxicTerms,
        sourceTextField: 'context.level1.textToAnalyze'
      };
      const evaluator = new ToxicityEvaluator(config);
      const input = createMockInput('Clean response.');
      input.context = {
        level1: { textToAnalyze: 'Oh heck, this context is toxic.' }
      };
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['heck']);
    });

    it("should source text from response (AgentMessage) via sourceTextField='response'", async () => {
      const config: ToxicityEvaluatorConfig = {
        criterionName: 'ToxicityCheck',
        toxicTerms,
        sourceTextField: 'response'
      };
      const evaluator = new ToxicityEvaluator(config);
      const textContentForAgentMessage =
        'This agent message has a badword... I mean darn.';
      const agentMessageResponse: AgentMessage = {
        id: 'msg-toxic',
        role: 'assistant',
        content: textContentForAgentMessage, // content is string
        contentParts: [{ type: 'text', text: textContentForAgentMessage }], // contentParts is array
        createdAt: new Date()
      };
      const input = createMockInput(agentMessageResponse);
      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].metadata?.foundToxicTerms).toEqual(['darn']);
    });

    it('should return error if sourceTextField path is invalid (e.g., context path wrong)', async () => {
      const config: ToxicityEvaluatorConfig = {
        criterionName: 'ToxicityCheck',
        toxicTerms,
        sourceTextField: 'context.non.existent'
      };
      const evaluator = new ToxicityEvaluator(config);
      const input = createMockInput('Some text', [mockCriterion]);
      input.context = { valid: 'path' };

      const results = await evaluator.evaluate(input, [mockCriterion]);
      expect(results[0].score).toBe(false); // Default error score is false (toxic)
      expect(results[0].error).toBeDefined();
      expect(results[0].reasoning).toContain(
        "Source text field 'context.non.existent' did not yield a string"
      );
    });
  });

  // TODO: More tests for multiple rules, etc. (This refers to RuleBasedEvaluator)
});
