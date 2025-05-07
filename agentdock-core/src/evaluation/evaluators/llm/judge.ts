import { generateObject, type CoreTool } from 'ai';
import { z, ZodTypeAny } from 'zod';
// import type { LLMAdapter } from '../../../llm/types'; // No longer using LLMAdapter directly here
import type { CoreLLM } from '../../../llm/core-llm'; // Import CoreLLM
import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator, EvaluationScale } from '../../types';

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
  // TODO: Add more configuration options as needed (e.g., model parameters for generateObject, retry logic)
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
    if (!config.llm || !config.promptTemplate || !config.criterionName) {
      throw new Error('LLMJudgeEvaluator requires llm (CoreLLM instance), promptTemplate, and criterionName in config.');
    }
    this.config = config;
  }

  private getZodSchemaForScale(scale: EvaluationScale): ZodTypeAny {
    switch (scale) {
      case 'binary':
      case 'pass/fail':
        return z.union([
          z.boolean(),
          z.string().transform((val, ctx) => {
            const lowerVal = val.toLowerCase();
            if (lowerVal === 'true' || lowerVal === 'pass' || lowerVal === 'yes' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === 'fail' || lowerVal === 'no' || lowerVal === '0') return false;
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid boolean string" });
            return z.NEVER;
          })
        ]).describe("Score as boolean (or common string representations like 'true', 'pass', '1').");
      case 'likert5':
        return z.number().int().min(1).max(5).describe("Score as integer between 1 and 5.");
      case 'numeric':
        return z.number().describe("Score as a numeric value.");
      default: // Handles 'string' and any custom string scales (e.g., "low|medium|high")
        // For custom enum-like string scales, the user might need to provide the enum values in config
        // if they want strict validation against those specific strings at the Zod level.
        // For now, z.string() is a reasonable default for any other scale type.
        return z.string().describe("Score as a string value.");
    }
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);

    if (!targetCriterion) {
      return []; 
    }

    const scoreSchema = this.getZodSchemaForScale(targetCriterion.scale);
    const llmResponseSchema = z.object({
      score: scoreSchema,
      reasoning: z.string().optional().describe("The reasoning behind the score."),
    });

    try {
      const prompt = this.preparePrompt(input, targetCriterion);

      // Use Vercel AI SDK's generateObject to get structured output
      // Assuming this.config.llm can be used directly or adapted for generateObject's model parameter.
      // For example, if this.config.llm is an instance of OpenAI from 'openai', 
      // we might need to adapt it or expect it to be an @ai-sdk/openai model instance.
      // This is a potential point of friction depending on LLMAdapter's design.
      const { object: llmOutput } = await generateObject({
        model: this.config.llm.getModel(), 
        schema: llmResponseSchema, // Use the dynamically generated schema
        prompt: prompt,
        system: this.config.systemPrompt || 'You are an expert evaluator. Respond in JSON format as specified.',
        // tools: {} as Record<string, CoreTool<any, any>> // If no tools needed, pass empty object or omit if allowed
      });

      const normalizedScore = this.normalizeScore(llmOutput.score, targetCriterion.scale);

      if (normalizedScore.error) {
        throw new Error(`Score normalization failed: ${normalizedScore.error}`);
      }

      return [{
        criterionName: this.config.criterionName,
        score: normalizedScore.score!,
        reasoning: llmOutput.reasoning,
        evaluatorType: this.type,
      }];

    } catch (error: any) {
      console.error(`[${this.type}] Error evaluating criterion ${this.config.criterionName}:`, error);
      return [{
        criterionName: this.config.criterionName,
        score: 'error', // Indicate error in score
        evaluatorType: this.type,
        error: error instanceof Error ? error.message : String(error),
        reasoning: 'LLM Judge evaluation failed due to error.'
      }];
    }
  }

  /**
   * Prepares the prompt string to send to the LLM judge.
   * Instructs the LLM to respond in JSON matching the defined Zod schema.
   */
  private preparePrompt(input: EvaluationInput, criterion: EvaluationCriteria): string {
    let prompt = this.config.promptTemplate;
    // Basic placeholder replacement
    prompt = prompt.replace('{{input}}', input.prompt ? JSON.stringify(input.prompt) : 'N/A');
    prompt = prompt.replace('{{response}}', typeof input.response === 'string' ? input.response : JSON.stringify(input.response));
    prompt = prompt.replace('{{reference}}', input.groundTruth ? JSON.stringify(input.groundTruth) : 'N/A');
    prompt = prompt.replace('{{criterion_name}}', criterion.name);
    prompt = prompt.replace('{{criterion_description}}', criterion.description);
    prompt = prompt.replace('{{criterion_scale}}', JSON.stringify(criterion.scale));

    // Add instruction for JSON output based on schema
    prompt += `\\n\\nPlease provide your evaluation in JSON format. The JSON object must have a 'score' field and an optional 'reasoning' field. The 'score' should correspond to the criterion's scale: ${criterion.scale}.`;
    return prompt;
  }

  /**
   * Normalizes the raw score from the LLM based on the criterion's scale.
   */
  private normalizeScore(rawValue: any, scale: EvaluationScale): { score?: EvaluationResult['score'], error?: string } {
    switch (scale) {
      case 'binary':
      case 'pass/fail':
        if (typeof rawValue === 'boolean') return { score: rawValue };
        const lowerVal = String(rawValue).toLowerCase();
        if (lowerVal === 'true' || lowerVal === 'pass' || lowerVal === 'yes' || lowerVal === '1') return { score: true };
        if (lowerVal === 'false' || lowerVal === 'fail' || lowerVal === 'no' || lowerVal === '0') return { score: false };
        return { error: `Invalid value for ${scale} scale: ${rawValue}. Expected boolean or standard affirmative/negative string.` };
      
      case 'likert5':
        const numLikert = Number(rawValue);
        if (Number.isInteger(numLikert) && numLikert >= 1 && numLikert <= 5) return { score: numLikert };
        return { error: `Invalid value for likert5 scale: ${rawValue}. Expected integer between 1 and 5.` };

      case 'numeric':
        const numNumeric = Number(rawValue);
        if (!isNaN(numNumeric)) return { score: numNumeric };
        return { error: `Invalid value for numeric scale: ${rawValue}. Expected a number.` };
      
      // For 'string' scale, any string is technically valid as a score, but we might want to be stricter.
      // For now, accept any string if the raw value is a string.
      // If the scale is a custom string (e.g., "low|medium|high"), this simple normalization won't validate against those specific values.
      // That would require passing the allowed string values to normalizeScore or having a more complex EvaluationScale type.
      default: // Handles 'string' and any custom string scales
        if (typeof rawValue === 'string') return { score: rawValue };
        if (typeof rawValue === 'number' || typeof rawValue === 'boolean') return { score: String(rawValue) }; // Coerce common types to string
        return { error: `Value for scale '${scale}' could not be reliably converted to a string score: ${rawValue}`};
    }
  }
} 