import type {
  AgentMessage,
  EvaluationCriteria,
  EvaluationInput,
  EvaluationResult,
  Evaluator,
  MessageContent
} from '../../types';

// Renamed to reflect its direct usage with our MessageContent structure
interface ExtractedToolCall {
  toolName: string;
  toolArguments: Record<string, any>;
  toolCallId?: string; // Keep toolCallId as it's part of ToolCallContent
}

/**
 * Configuration for a single rule within the ToolUsageEvaluator.
 */
export interface ToolUsageRule {
  /** The name of the criterion this rule evaluates (e.g., "UsedRequiredTool", "CorrectToolParameters"). */
  criterionName: string;
  /** The specific tool name expected to be called. Case-sensitive. */
  expectedToolName?: string;
  /** Optional: A function or regex to validate arguments for the specified tool. */
  argumentChecks?: (args: Record<string, any> | undefined) => {
    isValid: boolean;
    reason?: string;
  }; // True if valid, false with reason if not
  /** Optional: Specifies if the tool call is required or just observed. Defaults to false (observed). */
  isRequired?: boolean;
  // sequence?: number; // TODO: [Phase 2] For more advanced sequence checking (e.g., must be 1st call)
  // minCount?: number;
  // maxCount?: number;
}

/**
 * Configuration for the ToolUsageEvaluator.
 */
export interface ToolUsageEvaluatorConfig {
  /** An array of tool usage rules to apply. */
  rules: ToolUsageRule[];
  /**
   * Specifies where to find tool call information in the EvaluationInput.
   * 'messageHistory': Looks for AgentMessage objects with tool_calls.
   * 'context': Looks in input.context.toolCalls (assuming a specific structure).
   * Defaults to 'messageHistory'.
   */
  toolDataSource?: 'messageHistory' | 'context'; // Extensible with more sources later
}

/**
 * Evaluates agent tool usage based on a set of configurable rules.
 * Checks for expected tool calls, argument validity, and requirements.
 */
export class ToolUsageEvaluator implements Evaluator {
  public readonly type = 'ToolUsage';
  private config: ToolUsageEvaluatorConfig;

  constructor(config: ToolUsageEvaluatorConfig) {
    if (!config.rules || config.rules.length === 0) {
      throw new Error(
        '[ToolUsageEvaluator] At least one rule must be provided in the configuration.'
      );
    }

    config.rules.forEach((rule, index) => {
      if (!rule.criterionName || rule.criterionName.trim() === '') {
        throw new Error(
          `[ToolUsageEvaluator] Rule for criterion '${rule.criterionName}' at index ${index} must have a non-empty criterionName.`
        );
      }

      if (
        rule.argumentChecks &&
        (!rule.expectedToolName || rule.expectedToolName.trim() === '')
      ) {
        throw new Error(
          `[ToolUsageEvaluator] Rule for criterion '${rule.criterionName}' at index ${index} specifies argumentChecks but no expectedToolName.`
        );
      }

      // Add validation: if a rule isRequired, it must specify an expectedToolName.
      if (
        rule.isRequired === true &&
        (!rule.expectedToolName || rule.expectedToolName.trim() === '')
      ) {
        throw new Error(
          `[ToolUsageEvaluator] Rule for criterion '${rule.criterionName}' at index ${index} is marked as isRequired but does not specify an expectedToolName.`
        );
      }
      // Further validation could be added here if needed.
    });

    this.config = {
      ...config,
      toolDataSource: config.toolDataSource || 'messageHistory'
    };
  }

  async evaluate(
    input: EvaluationInput,
    criteria: EvaluationCriteria[]
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    const actualToolCalls: ExtractedToolCall[] = this.extractToolCalls(input);

    for (const rule of this.config.rules) {
      const targetCriterion = criteria.find(
        (c) => c.name === rule.criterionName
      );
      if (!targetCriterion) {
        console.warn(
          `[ToolUsageEvaluator] Criterion "${rule.criterionName}" for a rule not found in input.criteria. Skipping rule.`
        );
        continue;
      }

      let score: boolean | number = false; // Default to fail or 0 for numeric scales if not otherwise determined
      let reasoning = 'Initial: Rule not evaluated or met.';
      let error: string | undefined = undefined;

      if (rule.expectedToolName) {
        const foundCalls = actualToolCalls.filter(
          (tc) => tc.toolName === rule.expectedToolName
        );
        const callCount = foundCalls.length;

        if (callCount > 0) {
          // For simplicity, let's check the first found call for argument validation if specified.
          // More complex scenarios might check all calls or specific instances.
          const firstFoundCall = foundCalls[0];
          reasoning = `Tool '${rule.expectedToolName}' was called ${callCount} time(s).`;
          score = true; // Assume pass unless argument check fails

          if (rule.argumentChecks) {
            const argValidation = rule.argumentChecks(
              firstFoundCall.toolArguments
            );
            if (!argValidation.isValid) {
              score = false;
              reasoning += ` Argument check failed for the first call: ${argValidation.reason || 'Invalid arguments.'}`;
            } else {
              reasoning += ` Argument check passed for the first call.`;
            }
          }
        } else {
          // Tool not called
          reasoning = `Expected tool '${rule.expectedToolName}' was not called.`;
          if (rule.isRequired) {
            score = false; // Required tool not called is a failure
          } else {
            // Optional tool not called.
            // For binary/pass-fail, this often means the condition (e.g., "Tool X was NOT used") is met, so true.
            // For numeric scales, it might be neutral (0.5) or 0 if presence implies a higher score.
            // Let's default to true for binary/pass-fail, and 0 for numeric (meaning no positive contribution).
            score =
              targetCriterion.scale === 'binary' ||
              targetCriterion.scale === 'pass/fail'
                ? true
                : 0;
            reasoning += ' (Tool was optional).';
          }
        }
      } else {
        reasoning =
          'Rule does not specify an expectedToolName; generic tool usage checks are not yet implemented for such rules.';
        score = false; // Cannot evaluate without a target tool for now
        error =
          'Rule configuration error: expectedToolName is missing for a specific tool check.';
      }

      // Adjust score type for binary/pass-fail scales if a numeric score was interim (e.g. from an arg check)
      // This part is a bit tricky. If score became a number but scale is binary, how to interpret?
      // For now, the logic above tries to set score to boolean directly for the main pass/fail conditions.
      // If a numeric scale is used with tool usage, the score would be 0 (tool not used/failed) or 1 (tool used correctly).
      // Let's ensure if it's binary/pass-fail, score is boolean.
      if (
        (targetCriterion.scale === 'binary' ||
          targetCriterion.scale === 'pass/fail') &&
        typeof score === 'number'
      ) {
        score = score > 0; // Simple conversion: any positive numeric indication means true for binary
      }
      // If target scale is numeric and score is boolean, convert true to 1, false to 0.
      if (targetCriterion.scale === 'numeric' && typeof score === 'boolean') {
        score = score ? 1 : 0;
      }

      results.push({
        criterionName: rule.criterionName,
        score: score,
        reasoning: reasoning,
        evaluatorType: this.type,
        error: error
      });
    }
    return results;
  }

  private extractToolCalls(input: EvaluationInput): ExtractedToolCall[] {
    const calls: ExtractedToolCall[] = [];
    if (
      this.config.toolDataSource === 'messageHistory' &&
      input.messageHistory
    ) {
      for (const message of input.messageHistory) {
        // Prioritize contentParts for structured tool call information
        if (
          message.role === 'assistant' &&
          message.contentParts &&
          Array.isArray(message.contentParts)
        ) {
          for (const part of message.contentParts) {
            // Iterate over message.contentParts
            if (part.type === 'tool_call') {
              calls.push({
                toolName: part.toolName,
                toolArguments: part.args,
                toolCallId: part.toolCallId
              });
            }
          }
        }
        // Optional: Add fallback to parse message.content (string) if contentParts is empty/missing
        // else if (message.role === 'assistant' && typeof message.content === 'string') { ... }
      }
    } else if (
      this.config.toolDataSource === 'context' &&
      input.context?.toolCalls
    ) {
      if (Array.isArray(input.context.toolCalls)) {
        calls.push(
          ...input.context.toolCalls
            .filter(
              (
                tc: any
              ): tc is ExtractedToolCall => // Type guard for safety
                tc &&
                typeof tc.toolName === 'string' &&
                (typeof tc.args === 'object' ||
                  typeof tc.toolArguments === 'object') // Accept either args or toolArguments
            )
            .map((tc: any) => ({
              // Map to ensure consistent output structure
              toolName: tc.toolName,
              toolCallId: tc.toolCallId, // Include toolCallId if available
              toolArguments: tc.args ?? tc.toolArguments // Prefer args if both exist, otherwise toolArguments
            }))
        );
      }
    }
    return calls;
  }
}
