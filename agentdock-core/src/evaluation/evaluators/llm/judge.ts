import type { LLMAdapter } from '../../../llm/types'; // Import LLMAdapter instead of LLM
import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';

/**
 * Configuration for the LLM-as-a-judge evaluator.
 */
export interface LLMJudgeConfig {
  /** The name of the criterion this judge evaluates (must match an EvaluationCriteria name) */
  criterionName: string;
  /** The configured LLM adapter instance to use for judging */
  llm: LLMAdapter;
  /** 
   * A prompt template for the LLM judge. 
   * Should include placeholders for input (prompt), response, reference (groundTruth), 
   * and criterion details (name, description, scale).
   * Example placeholders: {{input}}, {{response}}, {{reference}}, {{criterion_name}}, {{criterion_description}}, {{criterion_scale}}
   */
  promptTemplate: string;
  /** 
   * Optional: Instructions on how to parse the LLM's response to extract the score and reasoning.
   * This could be a regex pattern, JSON schema instructions, or specific keywords.
   * If not provided, a default parsing strategy might be used (e.g., expecting a simple score).
   */
  parsingInstructions?: string; 
  // TODO: Add more configuration options as needed (e.g., model parameters, retry logic)
}

/**
 * An Evaluator that uses a Large Language Model (LLM) to judge the quality 
 * of a response based on specified criteria.
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
      throw new Error('LLMJudgeEvaluator requires llm (LLMAdapter instance), promptTemplate, and criterionName in config.');
    }
    this.config = config;
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);

    // Only run if the specific criterion this judge handles is in the list for this run
    if (!targetCriterion) {
      return []; // Not applicable to this run
    }

    let result: EvaluationResult;

    try {
      // 1. Prepare the prompt using the template and input data
      const prompt = this.preparePrompt(input, targetCriterion);

      // 2. Call the LLM using the adapter
      // TODO: Implement actual LLM call using config.llm.generateText or generateStream
      const llmResponseText = await this.config.llm.generateText([ { role: 'user', content: prompt } ]); // Example call structure
      // const llmResponseText = "Placeholder LLM Response: Score=4, Reasoning=Looks good."; // Placeholder

      // 3. Parse the LLM's response
      const { score, reasoning } = this.parseLLMResponse(llmResponseText, targetCriterion.scale);

      result = {
        criterionName: this.config.criterionName,
        score: score,
        reasoning: reasoning || `LLM Judge based on: ${llmResponseText}`, // Include raw response if no reasoning extracted
        evaluatorType: this.type,
      };

    } catch (error: any) {
      console.error(`[${this.type}] Error evaluating criterion ${this.config.criterionName}:`, error);
      result = {
        criterionName: this.config.criterionName,
        score: false, // Or some error indicator score?
        evaluatorType: this.type,
        error: error instanceof Error ? error.message : String(error),
        reasoning: 'LLM Judge evaluation failed due to error.'
      };
    }

    return [result];
  }

  /**
   * Prepares the prompt string to send to the LLM judge.
   */
  private preparePrompt(input: EvaluationInput, criterion: EvaluationCriteria): string {
    // Basic placeholder replacement - might need more robust templating
    let prompt = this.config.promptTemplate;
    prompt = prompt.replace('{{input}}', JSON.stringify(input.prompt)); // Use input.prompt
    prompt = prompt.replace('{{response}}', typeof input.response === 'string' ? input.response : JSON.stringify(input.response));
    prompt = prompt.replace('{{reference}}', input.groundTruth ? JSON.stringify(input.groundTruth) : 'N/A'); // Use input.groundTruth
    prompt = prompt.replace('{{criterion_name}}', criterion.name);
    prompt = prompt.replace('{{criterion_description}}', criterion.description);
    prompt = prompt.replace('{{criterion_scale}}', JSON.stringify(criterion.scale)); // Provide scale info

    // TODO: Add more sophisticated template filling logic if needed
    return prompt;
  }

  /**
   * Parses the raw text response from the LLM to extract score and reasoning.
   * TODO: Implement actual parsing based on config.parsingInstructions or defaults.
   */
  private parseLLMResponse(llmResponse: string, scale: EvaluationCriteria['scale']): { score: EvaluationResult['score'], reasoning?: string } {
    // Placeholder parsing logic - extremely basic
    let score: EvaluationResult['score'] = false; // Default to fail/false
    let reasoning: string | undefined = llmResponse; // Default reasoning is the raw response

    const scoreMatch = llmResponse.match(/Score=(\d+(\.\d+)?|true|false|pass|fail)/i);
    const reasoningMatch = llmResponse.match(/Reasoning=(.*)/i);

    if (scoreMatch && scoreMatch[1]) {
        const scoreStr = scoreMatch[1].toLowerCase();
        if (scoreStr === 'true' || scoreStr === 'pass') score = true;
        else if (scoreStr === 'false' || scoreStr === 'fail') score = false;
        else {
            const numScore = parseFloat(scoreStr);
            if (!isNaN(numScore)) {
                // TODO: Validate numeric score against scale if possible?
                score = numScore;
            } else {
                 // If scale is string, maybe the score itself is the string value?
                 if (scale === 'string') {
                     score = scoreStr; // Use raw string if scale allows
                 } else {
                     console.warn(`[${this.type}] Could not parse score value: ${scoreStr}`);
                 }
            }
        }
    } else {
         console.warn(`[${this.type}] Could not find score in LLM response: ${llmResponse}`);
         // Attempt to infer score based on keywords if no explicit score found? Risky.
    }

    if (reasoningMatch && reasoningMatch[1]) {
      reasoning = reasoningMatch[1].trim();
    }

    // TODO: Add more robust parsing logic based on config.parsingInstructions
    // TODO: Convert parsed score to match the expected type based on 'scale' (e.g., number for numeric/likert, boolean for binary)

    return { score, reasoning };
  }
} 