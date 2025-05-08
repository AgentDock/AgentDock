import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import { getInputText } from '../../utils/input-text-extractor';

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
  /** Optional: Field in EvaluationInput to use as the text source for this rule. Defaults to 'response'. */
  sourceTextField?: 'response' | 'prompt' | 'groundTruth' | `response.${string}` | `groundTruth.${string}` | `context.${string}`;
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

    for (const rule of this.rules) {
      if (!applicableCriteriaNames.has(rule.criterionName)) {
        continue;
      }

      const criterion = criteria.find(c => c.name === rule.criterionName);
      if (!criterion) {
        console.error(`[${this.type}] Criterion ${rule.criterionName} not found in provided criteria list.`);
        continue;
      }

      let result: EvaluationResult;
      try {
        let rulePassed: boolean;
        let score: EvaluationResult['score'] = false;
        let textForRule: string | undefined = undefined; // Variable to hold text for the current rule

        // Determine the source field for this specific rule
        const fieldToUse = rule.sourceTextField || 'response';

        // Get text only if the rule type needs it
        if (rule.config.type !== 'json_parse') {
          textForRule = getInputText(input, fieldToUse);

          if (textForRule === undefined) {
            results.push({
              criterionName: rule.criterionName,
              score: this.mapPassFailToScore(false, criterion.scale),
              reasoning: `Cannot evaluate rule '${rule.config.type}': input from '${fieldToUse}' is not a simple string or extractable text.`, 
              evaluatorType: this.type,
              error: `Source field '${fieldToUse}' did not yield a string.`
            });
            continue;
          }
        }

        switch (rule.config.type) {
          case 'regex':
            rulePassed = this.evaluateRegex(textForRule!, rule.config); // Use textForRule
            break;
          case 'length':
            rulePassed = this.evaluateLength(textForRule!, rule.config); // Use textForRule
            break;
          case 'includes':
            rulePassed = this.evaluateIncludes(textForRule!, rule.config); // Use textForRule
            break;
          case 'json_parse': {
            // For json_parse, if input.response is a string, use it directly.
            // Otherwise, stringify the raw input.response object.
            const stringToParse =
              typeof input.response === 'string'
                ? input.response
                : JSON.stringify(input.response, (_k, v) =>
                    typeof v === 'function' ? undefined : v,
                  );
            rulePassed = this.evaluateJsonParse(stringToParse);
            break;
          }
          default:
            // Add a check here for exhaustive switch, although TS might catch it
            // const _exhaustiveCheck: never = rule.config;
            throw new Error(`Unsupported rule type: ${(rule.config as any).type}`);
        }

        score = this.mapPassFailToScore(rulePassed, criterion.scale);

        result = {
          criterionName: rule.criterionName,
          score: score,
          reasoning: `Rule ${rule.config.type} on field '${fieldToUse}' ${rulePassed ? 'passed' : 'failed'}.`, // Updated reasoning
          evaluatorType: this.type,
        };

      } catch (error: any) {
        console.error(`[${this.type}] Error evaluating rule for criterion ${rule.criterionName}:`, error);
        result = {
          criterionName: rule.criterionName,
          score: this.mapPassFailToScore(false, criterion.scale), // Map error to a failed score
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