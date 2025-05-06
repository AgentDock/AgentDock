import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';

// --- Rule Definitions ---

/** Base type for rule configuration */
interface BaseRuleConfig {
  // Common config properties if any in the future
}

/** Configuration for a regex matching rule */
interface RegexRuleConfig extends BaseRuleConfig {
  type: 'regex';
  /** The RegExp pattern string */
  pattern: string;
  /** Optional RegExp flags (e.g., 'i' for case-insensitive) */
  flags?: string;
  /** Whether a match or non-match is considered passing */
  expectedOutcome: 'match' | 'no_match';
}

/** Configuration for a response length checking rule */
interface LengthRuleConfig extends BaseRuleConfig {
  type: 'length';
  /** Minimum acceptable length (inclusive) */
  min?: number;
  /** Maximum acceptable length (inclusive) */
  max?: number;
}

/** Configuration for checking keyword inclusion */
interface IncludesRuleConfig extends BaseRuleConfig {
  type: 'includes';
  /** Keywords or substrings to check for */
  keywords: string[];
  /** Whether the check is case sensitive (default: false) */
  caseSensitive?: boolean;
  /** Defines passing condition: all keywords found, any keyword found, or none found */
  expectedOutcome: 'all' | 'any' | 'none';
}

/** Configuration for checking if the response is valid JSON */
interface JsonParseRuleConfig extends BaseRuleConfig {
  type: 'json_parse';
  // No specific config needed, just checks if JSON.parse succeeds
}

// Union type for all supported rule configurations
export type RuleConfig = RegexRuleConfig | LengthRuleConfig | IncludesRuleConfig | JsonParseRuleConfig;

/** Represents a single evaluation rule linked to a criterion */
export interface EvaluationRule {
  /** The name of the criterion this rule evaluates (must match an EvaluationCriteria name) */
  criterionName: string;
  /** The configuration defining the rule's logic and parameters */
  config: RuleConfig;
}

// --- Evaluator Implementation ---

/**
 * An Evaluator that assesses inputs based on a predefined set of deterministic rules.
 */
export class RuleBasedEvaluator implements Evaluator {
  public readonly type = 'RuleBased';
  private rules: EvaluationRule[];

  /**
   * Creates an instance of RuleBasedEvaluator.
   * @param rules An array of evaluation rules to apply.
   */
  constructor(rules: EvaluationRule[]) {
    if (!Array.isArray(rules)) {
      throw new Error('RuleBasedEvaluator requires an array of rules.');
    }
    this.rules = rules;
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const applicableCriteriaNames = new Set(criteria.map(c => c.name));
    const results: EvaluationResult[] = [];

    // Get the text content to evaluate
    let textToEvaluate: string | undefined;
    if (typeof input.response === 'string') {
      textToEvaluate = input.response;
    } else if (typeof input.response?.content === 'string') {
      // Basic handling for AgentMessage with string content
      textToEvaluate = input.response.content;
    } else {
      // Cannot evaluate non-string content with current rules
      // TODO: Consider stringifying complex content or adding rules for structured data?
      console.warn(`[${this.type}] Cannot evaluate non-string response content for input.`);
      // Add error results for all applicable rules? Or just return empty?
      // Let's skip rules that require text for now.
    }

    for (const rule of this.rules) {
      // Only run the rule if its criterion is relevant for this run
      if (!applicableCriteriaNames.has(rule.criterionName)) {
        continue;
      }

      const criterion = criteria.find(c => c.name === rule.criterionName);
      if (!criterion) {
        // Should not happen if applicableCriteriaNames is derived correctly, but belt-and-suspenders
        console.error(`[${this.type}] Criterion ${rule.criterionName} not found in provided criteria list.`);
        continue;
      }

      let result: EvaluationResult;
      try {
        if (textToEvaluate === undefined && rule.config.type !== 'json_parse') { 
            // Skip text based rules if no text was extracted
            // Json parse can still work if response is a stringified object
            // Or maybe we should attempt JSON parse on the raw response if it's an object?
            // For now, keep it simple: skip if no string is readily available for text rules
            continue; 
        }
        
        let responseStringForJson = typeof input.response === 'string' ? input.response : JSON.stringify(input.response);

        let rulePassed: boolean;
        let score: EvaluationResult['score'] = false; // Default to failing/false

        switch (rule.config.type) {
          case 'regex':
            rulePassed = this.evaluateRegex(textToEvaluate!, rule.config);
            break;
          case 'length':
            rulePassed = this.evaluateLength(textToEvaluate!, rule.config);
            break;
          case 'includes':
            rulePassed = this.evaluateIncludes(textToEvaluate!, rule.config);
            break;
          case 'json_parse':
             // Attempt parsing even if textToEvaluate is undefined, use original response if string
            rulePassed = this.evaluateJsonParse(responseStringForJson);
            break;
          default:
            throw new Error(`Unsupported rule type: ${(rule.config as any).type}`);
        }

        // Map boolean pass/fail to score based on criterion scale
        score = this.mapPassFailToScore(rulePassed, criterion.scale);

        result = {
          criterionName: rule.criterionName,
          score: score,
          reasoning: `Rule ${rule.config.type} ${rulePassed ? 'passed' : 'failed'}`,
          evaluatorType: this.type,
        };

      } catch (error: any) {
        console.error(`[${this.type}] Error evaluating rule for criterion ${rule.criterionName}:`, error);
        result = {
          criterionName: rule.criterionName,
          score: false, // Consider using a specific error score/value?
          evaluatorType: this.type,
          error: error instanceof Error ? error.message : String(error),
          reasoning: 'Rule evaluation failed due to error.'
        };
      }
      results.push(result);
    }

    return results;
  }

  // --- Rule Evaluation Logic ---

  private evaluateRegex(text: string, config: RegexRuleConfig): boolean {
    try {
      const regex = new RegExp(config.pattern, config.flags);
      const matchResult = regex.test(text);
      return config.expectedOutcome === 'match' ? matchResult : !matchResult;
    } catch (e) {
      throw new Error(`Invalid regex pattern or flags: ${e}`);
    }
  }

  private evaluateLength(text: string, config: LengthRuleConfig): boolean {
    const len = text.length;
    const minOk = config.min === undefined || len >= config.min;
    const maxOk = config.max === undefined || len <= config.max;
    return minOk && maxOk;
  }

  private evaluateIncludes(text: string, config: IncludesRuleConfig): boolean {
    const checkText = config.caseSensitive ? text : text.toLowerCase();
    const keywords = config.keywords.map(k => config.caseSensitive ? k : k.toLowerCase());
    
    let foundCount = 0;
    for (const keyword of keywords) {
      if (checkText.includes(keyword)) {
        foundCount++;
      }
    }

    switch (config.expectedOutcome) {
      case 'all':
        return foundCount === keywords.length;
      case 'any':
        return foundCount > 0;
      case 'none':
        return foundCount === 0;
      default:
        return false; // Should not happen
    }
  }

  private evaluateJsonParse(text: string): boolean {
      try {
          JSON.parse(text);
          return true;
      } catch (e) {
          return false;
      }
  }

  /** Maps a boolean pass/fail outcome to a score based on the criterion's scale */
  private mapPassFailToScore(passed: boolean, scale: EvaluationCriteria['scale']): EvaluationResult['score'] {
    switch (scale) {
      case 'binary':
      case 'pass/fail':
        return passed;
      case 'numeric':
        // Simple 0/1 mapping for numeric pass/fail
        return passed ? 1 : 0;
      case 'likert5':
        // Map pass to 5, fail to 1 for Likert scale - simplistic but provides a value
        return passed ? 5 : 1;
      case 'string':
        // Map to "pass" / "fail" strings
        return passed ? 'pass' : 'fail';
      default:
        // If scale is a custom string or unknown, default to boolean
        console.warn(`[${this.type}] Unknown scale '${scale}' for mapping pass/fail score. Defaulting to boolean.`);
        return passed;
    }
  }
} 