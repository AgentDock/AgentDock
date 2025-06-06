// Import specific content types and AgentMessage from evaluation/types which re-exports them
import type {
  AgentMessage,
  EvaluationCriteria,
  EvaluationInput,
  EvaluationResult,
  MessageContent, // Union type for contentParts
  TextContent, // Specific type for text parts
  ToolCallContent // Specific type for constructing tool call data
} from '../../../types';
import {
  ToolUsageEvaluator,
  type ToolUsageEvaluatorConfig,
  type ToolUsageRule
} from '../usage';

// Mock a helper to create AgentMessage objects easily
const createMockAgentMessage = (
  id: string,
  role: 'user' | 'assistant' | 'system' | 'data', // Corrected MessageRole
  // 'textOrParts' can be a simple string for content, or an array for contentParts
  textOrParts: string | MessageContent[],
  // 'explicitToolCalls' are raw ToolCallContent objects if this message is an assistant making calls
  explicitToolCalls?: ToolCallContent[]
): AgentMessage => {
  let contentString: string;
  let parts: MessageContent[] | undefined;

  if (typeof textOrParts === 'string') {
    contentString = textOrParts;
    parts = [{ type: 'text', text: textOrParts } as TextContent];
  } else {
    // If textOrParts is an array, we find the first text part for the primary content string, or use empty.
    const firstTextPart = textOrParts.find((p) => p.type === 'text') as
      | TextContent
      | undefined;
    contentString = firstTextPart?.text || '';
    parts = [...textOrParts]; // Use the provided parts directly
  }

  // If there are explicit tool calls (typically for an assistant message),
  // add them to the parts array.
  if (
    role === 'assistant' &&
    explicitToolCalls &&
    explicitToolCalls.length > 0
  ) {
    parts = [...(parts || []), ...explicitToolCalls];
  }

  const msg: AgentMessage = {
    id,
    role,
    content: contentString, // Message.content is always string
    contentParts: parts, // Structured content goes here
    createdAt: new Date(),
    // If it's a tool result message, its role should be 'data' and it might have isToolMessage flag
    ...(role === 'data' && { isToolMessage: true })
  };
  return msg;
};

describe('ToolUsageEvaluator', () => {
  let mockInput: EvaluationInput;
  const mockToolCriterion: EvaluationCriteria = {
    name: 'UsedCorrectTool',
    description: 'Checks tool usage',
    scale: 'binary'
  };

  beforeEach(() => {
    mockInput = {
      response: createMockAgentMessage('resp1', 'assistant', 'Final response'),
      criteria: [mockToolCriterion],
      messageHistory: [],
      context: {}
    };
  });

  // Constructor Error Tests
  describe('Constructor Error Handling', () => {
    it('should throw if config.rules is missing or empty', () => {
      const badConfig1: Partial<ToolUsageEvaluatorConfig> = {};
      const badConfig2: ToolUsageEvaluatorConfig = { rules: [] };
      expect(
        () => new ToolUsageEvaluator(badConfig1 as ToolUsageEvaluatorConfig)
      ).toThrow(
        '[ToolUsageEvaluator] At least one rule must be provided in the configuration.'
      );
      expect(() => new ToolUsageEvaluator(badConfig2)).toThrow(
        '[ToolUsageEvaluator] At least one rule must be provided in the configuration.'
      );
    });

    const validRuleBase: Omit<
      ToolUsageRule,
      'criterionName' | 'expectedToolName'
    > = {};
    it('should throw if a rule is missing criterionName', () => {
      const rules = [
        { ...validRuleBase, expectedToolName: 'get_weather' }
      ] as unknown as ToolUsageRule[]; // Cast for test
      expect(() => new ToolUsageEvaluator({ rules })).toThrow(
        "[ToolUsageEvaluator] Rule for criterion 'undefined' at index 0 must have a non-empty criterionName."
      );
    });

    it('should throw if a rule has empty criterionName', () => {
      const rules = [
        {
          ...validRuleBase,
          criterionName: ' ',
          expectedToolName: 'get_weather'
        }
      ] as ToolUsageRule[];
      expect(() => new ToolUsageEvaluator({ rules })).toThrow(
        "[ToolUsageEvaluator] Rule for criterion ' ' at index 0 must have a non-empty criterionName."
      );
    });
  });

  describe('Rule Evaluation - Basic Tool Call Checks', () => {
    it('should pass if expected tool call is found in messageHistory (contentParts)', async () => {
      const rules: ToolUsageRule[] = [
        { criterionName: 'UsedCorrectTool', expectedToolName: 'get_weather' }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msg1',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tc1',
              toolName: 'get_weather',
              args: { location: 'London' }
            }
          ]
        )
      ];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results).toHaveLength(1);
      expect(results[0].criterionName).toBe('UsedCorrectTool');
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Tool 'get_weather' was called 1 time(s)."
      );
    });

    it('should fail if expected tool call is NOT found in messageHistory (and isRequired)', async () => {
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedCorrectTool',
          expectedToolName: 'get_stock_price',
          isRequired: true
        }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msg1',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tc1',
              toolName: 'get_weather',
              args: { location: 'London' }
            }
          ]
        )
      ];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain(
        "Expected tool 'get_stock_price' was not called."
      );
    });

    it('should correctly source tool calls from input.context if toolDataSource is context', async () => {
      const rules: ToolUsageRule[] = [
        { criterionName: 'UsedCorrectTool', expectedToolName: 'process_data' }
      ];
      const config: ToolUsageEvaluatorConfig = {
        rules,
        toolDataSource: 'context'
      };
      const evaluator = new ToolUsageEvaluator(config);
      mockInput.context = {
        toolCalls: [
          {
            toolCallId: 'ctx_tc1',
            toolName: 'process_data',
            args: { dataId: '123' },
            toolArguments: { dataId: '123' }
          }
        ]
      };
      mockInput.messageHistory = [];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Tool 'process_data' was called 1 time(s)."
      );
    });

    it('should fail if toolDataSource is context but context field is missing or not an array (and isRequired)', async () => {
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedCorrectTool',
          expectedToolName: 'process_data',
          isRequired: true
        }
      ];
      const config: ToolUsageEvaluatorConfig = {
        rules,
        toolDataSource: 'context'
      };
      const evaluator = new ToolUsageEvaluator(config);

      // Test 1: Context field 'toolCalls' missing
      mockInput.context = {};
      let results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain(
        "Expected tool 'process_data' was not called."
      );

      // Test 2: Context field 'toolCalls' not an array
      mockInput.context = { toolCalls: { toolName: 'wrong_type' } };
      results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain(
        "Expected tool 'process_data' was not called."
      );
    });
  });

  describe('Rule Evaluation - isRequired Flag', () => {
    const requiredRule: ToolUsageRule = {
      criterionName: 'UsedCorrectTool',
      expectedToolName: 'mandatory_tool',
      isRequired: true
    };
    const optionalRule: ToolUsageRule = {
      criterionName: 'UsedCorrectTool',
      expectedToolName: 'optional_tool',
      isRequired: false // Or omitted, as false is default
    };

    it('should FAIL if isRequired=true and tool is NOT called', async () => {
      const evaluator = new ToolUsageEvaluator({ rules: [requiredRule] });
      mockInput.messageHistory = []; // No tool calls
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain(
        "Expected tool 'mandatory_tool' was not called."
      );
    });

    it('should PASS (for binary scale) if isRequired=false and tool is NOT called', async () => {
      const evaluator = new ToolUsageEvaluator({ rules: [optionalRule] });
      mockInput.messageHistory = []; // No tool calls
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      // Default behavior for optional not called seems to be pass (true) for binary scale
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Expected tool 'optional_tool' was not called. (Tool was optional)."
      );
    });

    it('should produce score 0 (for numeric scale) if isRequired=false and tool is NOT called', async () => {
      const numericCriterion: EvaluationCriteria = {
        ...mockToolCriterion,
        scale: 'numeric'
      };
      const evaluator = new ToolUsageEvaluator({ rules: [optionalRule] });
      mockInput.messageHistory = [];
      mockInput.criteria = [numericCriterion]; // Use numeric criterion
      const results = await evaluator.evaluate(mockInput, [numericCriterion]);
      // Implementation notes suggest score 0 for numeric scale when optional tool not called
      expect(results[0].score).toBe(0);
      expect(results[0].reasoning).toContain(
        "Expected tool 'optional_tool' was not called. (Tool was optional)."
      );
    });

    it('should PASS if isRequired=true and tool IS called', async () => {
      const evaluator = new ToolUsageEvaluator({ rules: [requiredRule] });
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msg1',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tc1',
              toolName: 'mandatory_tool',
              args: {}
            }
          ]
        )
      ];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Tool 'mandatory_tool' was called 1 time(s)."
      );
    });

    it('should PASS if isRequired=false and tool IS called', async () => {
      const evaluator = new ToolUsageEvaluator({ rules: [optionalRule] });
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msg1',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tc1',
              toolName: 'optional_tool',
              args: {}
            }
          ]
        )
      ];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Tool 'optional_tool' was called 1 time(s)."
      );
    });
  });

  describe('Rule Evaluation - argumentChecks', () => {
    const mockArgs = { location: 'Paris', unit: 'celsius' };
    const toolCallMessage = createMockAgentMessage(
      'msg1',
      'assistant',
      [],
      [
        {
          type: 'tool_call',
          toolCallId: 'tc_weather',
          toolName: 'get_weather',
          args: mockArgs
        }
      ]
    );

    it('should PASS if argumentChecks returns { isValid: true }', async () => {
      const checkFn = jest.fn().mockReturnValue({ isValid: true });
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedCorrectTool',
          expectedToolName: 'get_weather',
          argumentChecks: checkFn
        }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [toolCallMessage];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(checkFn).toHaveBeenCalledWith(mockArgs);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain('Argument check passed');
    });

    it('should FAIL if argumentChecks returns { isValid: false }', async () => {
      const failReason = 'Missing unit parameter';
      const checkFn = jest
        .fn()
        .mockReturnValue({ isValid: false, reason: failReason });
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedCorrectTool',
          expectedToolName: 'get_weather',
          argumentChecks: checkFn
        }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [toolCallMessage];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(checkFn).toHaveBeenCalledWith(mockArgs);
      expect(results[0].score).toBe(false);
      expect(results[0].reasoning).toContain(
        `Argument check failed for the first call: ${failReason}`
      );
    });

    it('should still PASS overall if argumentChecks is not provided (no check performed)', async () => {
      const rules: ToolUsageRule[] = [
        { criterionName: 'UsedCorrectTool', expectedToolName: 'get_weather' } // No argumentChecks
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [toolCallMessage];
      const results = await evaluator.evaluate(mockInput, [mockToolCriterion]);
      expect(results[0].score).toBe(true);
      expect(results[0].reasoning).toContain(
        "Tool 'get_weather' was called 1 time(s)."
      ); // No mention of arg check
    });

    // Note: The current implementation doesn't seem to explicitly handle errors *within* the argumentChecks function.
    // If the checkFn throws, it would likely propagate and be caught by the main try/catch in evaluate,
    // resulting in a generic 'Rule evaluation failed due to error.' result.
    // Adding a test for this might be useful depending on desired behavior.
  });

  describe('Rule Evaluation - Multiple Rules and Criteria Matching', () => {
    const crit1: EvaluationCriteria = {
      name: 'UsedWeatherTool',
      description: '...',
      scale: 'binary'
    };
    const crit2: EvaluationCriteria = {
      name: 'UsedStockTool',
      description: '...',
      scale: 'binary'
    };
    const crit3: EvaluationCriteria = {
      name: 'CorrectWeatherArgs',
      description: '...',
      scale: 'binary'
    };
    const allCriteria = [crit1, crit2, crit3];

    const rule1: ToolUsageRule = {
      criterionName: 'UsedWeatherTool',
      expectedToolName: 'get_weather'
    };
    const rule2: ToolUsageRule = {
      criterionName: 'UsedStockTool',
      expectedToolName: 'get_stock_price',
      isRequired: true
    };
    const rule3: ToolUsageRule = {
      criterionName: 'CorrectWeatherArgs',
      expectedToolName: 'get_weather',
      argumentChecks: (args) => ({ isValid: args?.location === 'London' })
    };

    const evaluator = new ToolUsageEvaluator({ rules: [rule1, rule2, rule3] });

    beforeEach(() => {
      // Reset input for each test in this block
      mockInput = {
        response: createMockAgentMessage('respMulti', 'assistant', 'Response'),
        criteria: allCriteria,
        messageHistory: [],
        context: {}
      };
    });

    it('should evaluate multiple rules correctly based on tool calls', async () => {
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msgA',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tcW',
              toolName: 'get_weather',
              args: { location: 'London' }
            }
          ]
        )
      ]; // Only weather tool called

      const results = await evaluator.evaluate(mockInput, allCriteria);
      expect(results).toHaveLength(3);

      const weatherResult = results.find(
        (r) => r.criterionName === 'UsedWeatherTool'
      );
      const stockResult = results.find(
        (r) => r.criterionName === 'UsedStockTool'
      );
      const weatherArgsResult = results.find(
        (r) => r.criterionName === 'CorrectWeatherArgs'
      );

      expect(weatherResult?.score).toBe(true); // Weather tool was called
      expect(stockResult?.score).toBe(false); // Stock tool was required but not called
      expect(weatherArgsResult?.score).toBe(true); // Weather args were correct
    });

    it('should skip rules whose criteria are not present in the input criteria', async () => {
      mockInput.messageHistory = [
        createMockAgentMessage(
          'msgA',
          'assistant',
          [],
          [
            {
              type: 'tool_call',
              toolCallId: 'tcW',
              toolName: 'get_weather',
              args: { location: 'London' }
            }
          ]
        )
      ];
      // Only provide criteria for UsedWeatherTool
      const limitedCriteria = [crit1];
      mockInput.criteria = limitedCriteria;

      const results = await evaluator.evaluate(mockInput, limitedCriteria);
      expect(results).toHaveLength(1); // Only rule1 should be evaluated
      expect(results[0].criterionName).toBe('UsedWeatherTool');
      expect(results[0].score).toBe(true);
    });
  });

  describe('Multiple Rules', () => {
    const criteria: EvaluationCriteria[] = [
      { name: 'UsedWeather', description: '', scale: 'binary' },
      { name: 'UsedStock', description: '', scale: 'binary' },
      { name: 'WeatherArgsValid', description: '', scale: 'binary' }
    ];

    const weatherCall = createMockAgentMessage(
      'msgW',
      'assistant',
      [],
      [
        {
          type: 'tool_call',
          toolCallId: 'tcW',
          toolName: 'get_weather',
          args: { location: 'London' }
        }
      ]
    );
    const stockCall = createMockAgentMessage(
      'msgS',
      'assistant',
      [],
      [
        {
          type: 'tool_call',
          toolCallId: 'tcS',
          toolName: 'get_stock',
          args: { ticker: 'GOOG' }
        }
      ]
    );

    it('should evaluate multiple rules correctly (all pass)', async () => {
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedWeather',
          expectedToolName: 'get_weather',
          isRequired: true
        },
        {
          criterionName: 'UsedStock',
          expectedToolName: 'get_stock',
          isRequired: true
        }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [weatherCall, stockCall];
      mockInput.criteria = criteria.filter(
        (c) => c.name === 'UsedWeather' || c.name === 'UsedStock'
      );

      const results = await evaluator.evaluate(mockInput, mockInput.criteria);
      expect(results).toHaveLength(2);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.score
      ).toBe(true);
      expect(results.find((r) => r.criterionName === 'UsedStock')?.score).toBe(
        true
      );
    });

    it('should evaluate multiple rules correctly (one required fail, one optional pass)', async () => {
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedWeather',
          expectedToolName: 'get_weather',
          isRequired: true
        }, // Will fail
        {
          criterionName: 'UsedStock',
          expectedToolName: 'get_stock',
          isRequired: false
        } // Will pass (found)
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [stockCall]; // Only stock called
      mockInput.criteria = criteria.filter(
        (c) => c.name === 'UsedWeather' || c.name === 'UsedStock'
      );

      const results = await evaluator.evaluate(mockInput, mockInput.criteria);
      expect(results).toHaveLength(2);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.score
      ).toBe(false);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.reasoning
      ).toContain('was not called');
      expect(results.find((r) => r.criterionName === 'UsedStock')?.score).toBe(
        true
      );
      expect(
        results.find((r) => r.criterionName === 'UsedStock')?.reasoning
      ).toContain('was called');
    });

    it('should evaluate multiple rules correctly (one required pass, one optional missing)', async () => {
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedWeather',
          expectedToolName: 'get_weather',
          isRequired: true
        }, // Will pass
        {
          criterionName: 'UsedStock',
          expectedToolName: 'get_stock',
          isRequired: false
        } // Will pass (optional missing)
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [weatherCall]; // Only weather called
      mockInput.criteria = criteria.filter(
        (c) => c.name === 'UsedWeather' || c.name === 'UsedStock'
      );

      const results = await evaluator.evaluate(mockInput, mockInput.criteria);
      expect(results).toHaveLength(2);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.score
      ).toBe(true);
      expect(results.find((r) => r.criterionName === 'UsedStock')?.score).toBe(
        true
      ); // Optional missing defaults to true for binary
      expect(
        results.find((r) => r.criterionName === 'UsedStock')?.reasoning
      ).toContain('was not called. (Tool was optional)');
    });

    it('should evaluate multiple rules including argument checks', async () => {
      const validCheck = jest.fn().mockReturnValue({ isValid: true });
      const invalidCheck = jest
        .fn()
        .mockReturnValue({ isValid: false, reason: 'Bad ticker' });
      const rules: ToolUsageRule[] = [
        {
          criterionName: 'UsedWeather',
          expectedToolName: 'get_weather',
          argumentChecks: validCheck
        },
        {
          criterionName: 'UsedStock',
          expectedToolName: 'get_stock',
          argumentChecks: invalidCheck
        }
      ];
      const evaluator = new ToolUsageEvaluator({ rules });
      mockInput.messageHistory = [weatherCall, stockCall];
      mockInput.criteria = criteria.filter(
        (c) => c.name === 'UsedWeather' || c.name === 'UsedStock'
      );

      const results = await evaluator.evaluate(mockInput, mockInput.criteria);
      expect(results).toHaveLength(2);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.score
      ).toBe(true);
      expect(
        results.find((r) => r.criterionName === 'UsedWeather')?.reasoning
      ).toContain('Argument check passed');
      expect(results.find((r) => r.criterionName === 'UsedStock')?.score).toBe(
        false
      );
      expect(
        results.find((r) => r.criterionName === 'UsedStock')?.reasoning
      ).toContain('Argument check failed for the first call: Bad ticker');
      expect(validCheck).toHaveBeenCalledWith({ location: 'London' });
      expect(invalidCheck).toHaveBeenCalledWith({ ticker: 'GOOG' });
    });
  });

  // TODO: [Phase 2] More tests for multiple rules, especially scenarios where rules might implicitly overlap
  // (e.g. different argument checks for the same tool, or different required counts for the same tool under different criteria),
  // and to verify behavior with future features like call sequence checking or disallowing unspecified tools.
  // Current multi-rule tests cover basic independent rule application.
});
