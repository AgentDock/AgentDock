import { generateObject, type CoreTool } from 'ai';
import { z, ZodTypeAny } from 'zod';
// import type { LLMAdapter } from '../../../llm/types'; // No longer using LLMAdapter directly here
import type { CoreLLM } from '../../../llm/core-llm'; // Import CoreLLM
import type {
  EvaluationCriteria,
  EvaluationInput,
  EvaluationResult,
  Evaluator,
  EvaluationScale,
} from '../../types';
import { getInputText } from '../../utils/input-text-extractor'; // Import getInputText

/**
 * Configuration for the LLM-as-a-judge evaluator.
 */
export interface LLMJudgeConfig {
  /** The name of the criterion this judge evaluates (must match an EvaluationCriteria name) */
  criterionName: string;
  /**
   * The configured CoreLLM instance to use for judging.
   */
  llm: CoreLLM; // Changed from LLMAdapter to CoreLLM
  /**
   * A prompt template for the LLM judge.
   * Should include placeholders for input (prompt), response, reference (groundTruth),
   * and criterion details (name, description, scale).
   * It should also instruct the LLM to respond in JSON format.
   * Example placeholders: {{input}}, {{response}}, {{reference}}, {{criterion_name}}, {{criterion_description}}, {{criterion_scale}}
   */
  promptTemplate: string;
  /**
   * Optional: A system prompt to guide the LLM's behavior.
   */
  systemPrompt?: string;
  // TODO: [Phase 2] Add more configuration options as needed (e.g., model parameters for generateObject, retry logic)
}

/**
 * An Evaluator that uses a Large Language Model (LLM) to judge the quality
 * of a response based on specified criteria using Vercel AI SDK for structured output.
 */
export class LLMJudgeEvaluator implements Evaluator {
  public readonly type = 'LLMJudge';
  private config: LLMJudgeConfig;

  /**
   * Creates an instance of LLMJudgeEvaluator.
   * @param config Configuration for the LLM judge.
   */
  constructor(config: LLMJudgeConfig) {
    // Improved validation
    if (!config.llm || typeof (config.llm as any).getModel !== 'function') {
      // Check if it looks like CoreLLM
      throw new Error(
        '[LLMJudgeEvaluator] llm must be provided and appear to be a CoreLLM instance.',
      );
    }
    if (
      !config.promptTemplate ||
      typeof config.promptTemplate !== 'string' ||
      config.promptTemplate.trim() === ''
    ) {
      throw new Error('[LLMJudgeEvaluator] promptTemplate must be a non-empty string.');
    }
    if (
      !config.criterionName ||
      typeof config.criterionName !== 'string' ||
      config.criterionName.trim() === ''
    ) {
      throw new Error('[LLMJudgeEvaluator] criterionName must be a non-empty string.');
    }
    this.config = config;
  }

  private getZodSchemaForScale(scale: EvaluationScale): ZodTypeAny {
    switch (scale) {
      case 'binary':
      case 'pass/fail':
        return z
          .union([
            z.boolean(),
            z.string().transform((val, ctx) => {
              const lowerVal = val.toLowerCase();
              if (
                lowerVal === 'true' ||
                lowerVal === 'pass' ||
                lowerVal === 'yes' ||
                lowerVal === '1'
              )
                return true;
              if (
                lowerVal === 'false' ||
                lowerVal === 'fail' ||
                lowerVal === 'no' ||
                lowerVal === '0'
              )
                return false;
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid boolean string' });
              return z.NEVER;
            }),
          ])
          .describe(
            "Score as boolean (or common string representations like 'true', 'pass', '1').",
          );
      case 'likert5':
        return z.number().int().min(1).max(5).describe('Score as integer between 1 and 5.');
      case 'numeric':
        return z.number().describe('Score as a numeric value.');
      default: // Handles 'string' and any custom string scales (e.g., "low|medium|high")
        // For custom enum-like string scales, the user might need to provide the enum values in config
        // if they want strict validation against those specific strings at the Zod level.
        // For now, z.string() is a reasonable default for any other scale type.
        return z.string().describe('Score as a string value.');
    }
  }

  async evaluate(
    input: EvaluationInput,
    criteria: EvaluationCriteria[],
  ): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find((c) => c.name === this.config.criterionName);

    if (!targetCriterion) {
      return [];
    }

    const scoreSchema = this.getZodSchemaForScale(targetCriterion.scale);
    const llmResponseSchema = z.object({
      score: scoreSchema,
      reasoning: z.string().optional().describe('The reasoning behind the score.'),
    });

    let prompt: string;
    try {
      prompt = this.preparePrompt(input, targetCriterion);
    } catch (e: any) {
      console.error(
        `[${this.type}] Error preparing prompt for criterion ${this.config.criterionName}:`,
        e,
      );
      return [
        {
          criterionName: this.config.criterionName,
          score: 'error',
          evaluatorType: this.type,
          error: `Prompt preparation failed: ${e.message}`,
          reasoning: 'LLM Judge evaluation failed during prompt preparation.',
        },
      ];
    }

    try {
      const { object: llmOutput } = await generateObject({
        model: this.config.llm.getModel(),
        schema: llmResponseSchema,
        prompt: prompt,
        system:
          this.config.systemPrompt ||
          'You are an expert evaluator. Respond in JSON format using the provided schema.', // Updated system prompt slightly
      });

      const normalizedScore = this.normalizeScore(llmOutput.score, targetCriterion.scale);

      if (normalizedScore.error) {
        // If normalization fails, return an error result but include the raw LLM output in reasoning/metadata if possible
        return [
          {
            criterionName: this.config.criterionName,
            score: 'error', // Keep score as 'error' to indicate failure
            reasoning: `Score normalization failed: ${normalizedScore.error}. Raw LLM reasoning: ${llmOutput.reasoning || 'N/A'}`,
            evaluatorType: this.type,
            error: `Score normalization failed: ${normalizedScore.error}`,
            metadata: { rawLlmScore: llmOutput.score, rawLlmReasoning: llmOutput.reasoning },
          },
        ];
      }

      return [
        {
          criterionName: this.config.criterionName,
          score: normalizedScore.score!, // Use the validated & normalized score
          reasoning: llmOutput.reasoning,
          evaluatorType: this.type,
          metadata: { rawLlmScore: llmOutput.score }, // Include raw LLM score in metadata
        },
      ];
    } catch (error: any) {
      console.error(
        `[${this.type}] Error evaluating criterion ${this.config.criterionName}:`,
        error,
      );
      return [
        {
          criterionName: this.config.criterionName,
          score: 'error',
          evaluatorType: this.type,
          error: error instanceof Error ? error.message : String(error),
          reasoning: 'LLM Judge evaluation failed due to error during LLM call or processing.',
        },
      ];
    }
  }

  /**
   * Prepares the prompt string to send to the LLM judge.
   * Instructs the LLM to respond in JSON matching the defined Zod schema.
   */
  private preparePrompt(input: EvaluationInput, criterion: EvaluationCriteria): string {
    let prompt = this.config.promptTemplate;

    // Use getInputText to handle string or AgentMessage extraction
    const inputText = getInputText(input, 'prompt') ?? 'N/A';
    const responseText = getInputText(input, 'response') ?? 'N/A';
    const referenceText = getInputText(input, 'groundTruth') ?? 'N/A';

    // Use split/join to replace all occurrences of each placeholder
    prompt = prompt.split('{{input}}').join(inputText);
    prompt = prompt.split('{{response}}').join(responseText);
    prompt = prompt.split('{{reference}}').join(referenceText);
    prompt = prompt.split('{{criterion_name}}').join(criterion.name);
    prompt = prompt.split('{{criterion_description}}').join(criterion.description);
    prompt = prompt.split('{{criterion_scale}}').join(criterion.scale); // Pass scale directly, not stringified

    // Replace any context variables like {{context.someKey}}
    // Use explicit chars + length limit for key to prevent ReDoS
    const contextRegex = /\\{\\{context\\.([\\w.-]{1,100})\\}\\}/g;
    prompt = prompt.replace(contextRegex, (_match, key) => {
      const value = input.context?.[key.trim()]; // Use key.trim() for safety
      // Stringify complex objects from context, otherwise use as is or 'N/A'
      if (value === undefined || value === null) return 'N/A';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });

    // Removed the appended JSON instruction - generateObject handles this.
    // prompt += `\\\\n\\\\nPlease provide your evaluation in JSON format...`;
    return prompt;
  }

  /**
   * Normalizes the raw score from the LLM based on the criterion's scale.
   */
  private normalizeScore(
    rawValue: any,
    scale: EvaluationScale,
  ): { score?: EvaluationResult['score']; error?: string } {
    switch (scale) {
      case 'binary':
      case 'pass/fail': {
        if (typeof rawValue === 'boolean') return { score: rawValue };
        const lowerVal = String(rawValue).toLowerCase();
        if (lowerVal === 'true' || lowerVal === 'pass' || lowerVal === 'yes' || lowerVal === '1')
          return { score: true };
        if (lowerVal === 'false' || lowerVal === 'fail' || lowerVal === 'no' || lowerVal === '0')
          return { score: false };
        return {
          error: `Invalid value for ${scale} scale: ${rawValue}. Expected boolean or standard pass/fail/binary strings.`,
        };
      }
      case 'likert5': {
        const numLikert = Number(rawValue);
        if (Number.isInteger(numLikert) && numLikert >= 1 && numLikert <= 5)
          return { score: numLikert };
        return {
          error: `Invalid value for likert5 scale: ${rawValue}. Expected integer between 1 and 5.`,
        };
      }
      case 'numeric': {
        if (rawValue === null || rawValue === undefined) {
          // Handle null and undefined explicitly
          return { error: `Invalid value for numeric scale: ${rawValue}. Expected a number.` };
        }
        if (typeof rawValue === 'string' && rawValue.trim() === '') {
          // Handle empty string
          return {
            error: `Invalid value for numeric scale: \"\" (empty string). Expected a number.`,
          };
        }
        const numNumeric = Number(rawValue);
        if (!isNaN(numNumeric)) return { score: numNumeric };
        return { error: `Invalid value for numeric scale: ${rawValue}. Expected a number.` };
      }
      // For 'string' scale, any string is technically valid as a score, but we might want to be stricter.
      // For now, accept any string if the raw value is a string.
      // If the scale is a custom string (e.g., "low|medium|high"), this simple normalization won't validate against those specific values.
      // That would require passing the allowed string values to normalizeScore or having a more complex EvaluationScale type.
      default: // Handles 'string' and any custom string scales
        if (typeof rawValue === 'string') return { score: rawValue };
        if (typeof rawValue === 'number' || typeof rawValue === 'boolean')
          return { score: String(rawValue) }; // Coerce common types to string
        return {
          error: `Value for scale '${scale}' could not be reliably converted to a string score: ${rawValue}`,
        };
    }
  }
}
