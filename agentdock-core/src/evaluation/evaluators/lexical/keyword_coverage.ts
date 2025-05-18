import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import { getInputText } from '../../utils/input-text-extractor';

/**
 * Configuration for the KeywordCoverageEvaluator.
 */
export interface KeywordCoverageEvaluatorConfig {
  /** The name of the criterion this evaluator assesses (e.g., "ResponseKeywordCoverage"). */
  criterionName: string;
  /**
   * An array of keywords to look for.
   * Required if keywordsSourceField is 'config' or not specified.
   */
  expectedKeywords?: string[];
  /**
   * Specifies where to load the expected keywords from.
   * 'config': Use `expectedKeywords` array from this configuration (default).
   * 'groundTruth': Expect `EvaluationInput.groundTruth` to be a string array of keywords or a string from which to extract keywords (e.g. comma-separated).
   * 'context.<field>': Expect `EvaluationInput.context[<field>]` to contain the keywords. (e.g., 'context.referenceKeywords')
   */
  keywordsSourceField?: 'config' | 'groundTruth' | `context.${string}`;
  /**
   * Field in EvaluationInput to use as the text to search within.
   * Can be a top-level field like 'response', 'prompt', 'groundTruth',
   * or a dot-notation path e.g., 'response.content[0].text', 'context.someKey.value'.
   * Defaults to 'response'.
   */
  sourceTextField?:
    | 'response'
    | 'prompt'
    | 'groundTruth'
    | `response.${string}`
    | `groundTruth.${string}`
    | `context.${string}`;
  /** Whether keyword matching should be case-sensitive. Defaults to false. */
  caseSensitive?: boolean;
  /** Whether to normalize whitespace in the source text before matching. Defaults to true. */
  normalizeWhitespaceForSource?: boolean;
  /** How to treat keywords when `keywordsSourceField` is 'groundTruth' and it's a string: 'exact' or 'split-comma'. Defaults to 'split-comma'. */
  groundTruthKeywordMode?: 'exact' | 'split-comma';
}

// Helper to safely get a value from a nested path
function getValueFromPath(obj: any, path: string): any {
  if (!path || typeof path !== 'string') return undefined;
  return path
    .split('.')
    .reduce((o, k) => (o && typeof o === 'object' && k in o ? o[k] : undefined), obj);
}

/**
 * Evaluates how many of a list of expected keywords are present in a source text.
 */
export class KeywordCoverageEvaluator implements Evaluator {
  public readonly type = 'KeywordCoverage';
  private config: Required<
    Omit<KeywordCoverageEvaluatorConfig, 'expectedKeywords' | 'keywordsSourceField'> &
      Pick<KeywordCoverageEvaluatorConfig, 'expectedKeywords' | 'keywordsSourceField'>
  >;

  constructor(config: KeywordCoverageEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[KeywordCoverageEvaluator] criterionName must be provided and non-empty.');
    }

    const keywordsSource = config.keywordsSourceField || 'config';
    if (
      keywordsSource === 'config' &&
      (!config.expectedKeywords || config.expectedKeywords.length === 0)
    ) {
      throw new Error(
        "[KeywordCoverageEvaluator] expectedKeywords must be provided in config when keywordsSourceField is 'config' or default.",
      );
    }
    if (keywordsSource.startsWith('context.') && keywordsSource.split('.').length < 2) {
      throw new Error(
        "[KeywordCoverageEvaluator] Invalid keywordsSourceField format for context. Expected 'context.fieldName'.",
      );
    }

    this.config = {
      criterionName: config.criterionName,
      expectedKeywords:
        keywordsSource === 'config' ? config.expectedKeywords! : config.expectedKeywords || [],
      keywordsSourceField: keywordsSource,
      sourceTextField: config.sourceTextField || 'response',
      caseSensitive: config.caseSensitive === undefined ? false : config.caseSensitive,
      normalizeWhitespaceForSource:
        config.normalizeWhitespaceForSource === undefined
          ? true
          : config.normalizeWhitespaceForSource,
      groundTruthKeywordMode: config.groundTruthKeywordMode || 'split-comma',
    };
  }

  private getKeywords(input: EvaluationInput): string[] | null {
    let keywords: string[] = [];
    const source = this.config.keywordsSourceField;

    if (source === 'config') {
      keywords = this.config.expectedKeywords || [];
    } else if (source === 'groundTruth') {
      if (Array.isArray(input.groundTruth)) {
        keywords = input.groundTruth.filter((k) => typeof k === 'string');
      } else if (typeof input.groundTruth === 'string' && input.groundTruth.trim() !== '') {
        if (this.config.groundTruthKeywordMode === 'exact') {
          keywords = [input.groundTruth.trim()];
        } else {
          // 'split-comma' or implicitly split by common delimiters
          keywords = input.groundTruth
            .split(/[,\s]+/)
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
        }
      } else {
        return null; // Expected groundTruth keywords but not found or invalid type
      }
    } else if (source && source.startsWith('context.')) {
      const path = source.substring('context.'.length);
      const contextValue = getValueFromPath(input.context, path);

      if (Array.isArray(contextValue)) {
        keywords = contextValue.filter((k) => typeof k === 'string');
      } else if (typeof contextValue === 'string' && contextValue.trim() !== '') {
        // Assume string from context should be split by common delimiters
        keywords = contextValue
          .split(/[,\s]+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
      } else {
        return null; // Expected context keywords but not found or invalid type
      }
    }

    if (keywords.length === 0 && source !== 'config') {
      // If not from config, and still no keywords, it's an issue.
      return null;
    }

    if (!this.config.caseSensitive) {
      keywords = keywords.map((k) => k.toLowerCase());
    }
    return keywords.filter((k) => k.length > 0); // Ensure no empty strings after processing
  }

  async evaluate(
    input: EvaluationInput,
    criteria: EvaluationCriteria[],
  ): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find((c) => c.name === this.config.criterionName);
    if (!targetCriterion) {
      return [];
    }

    const keywordsToFind = this.getKeywords(input);

    if (keywordsToFind === null) {
      // Keywords were expected from context/groundTruth but not found/invalid
      return [
        {
          criterionName: this.config.criterionName,
          score: 'error',
          reasoning: `Failed to source keywords from ${this.config.keywordsSourceField}. Source not found or invalid type.`,
          evaluatorType: this.type,
          error: `Keywords source ${this.config.keywordsSourceField} not found or not a string/array.`,
        },
      ];
    }

    if (
      keywordsToFind.length === 0 &&
      this.config.keywordsSourceField === 'config' &&
      (!this.config.expectedKeywords || this.config.expectedKeywords.length === 0)
    ) {
      // This case should ideally be caught by constructor, but as a safeguard:
      return [
        {
          criterionName: this.config.criterionName,
          score: 'error',
          reasoning:
            'Configuration error: expectedKeywords is empty or not provided for config source.',
          evaluatorType: this.type,
          error: 'Configuration error: expectedKeywords is empty for config source.',
        },
      ];
    }

    if (keywordsToFind.length === 0) {
      // If keywordsSourceField was 'config' and expectedKeywords was deliberately an empty array in config (valid)
      // or if after processing (e.g. filtering) an externally sourced list becomes empty (though `getKeywords` returning null should catch most problematic external sourcing)
      return [
        {
          criterionName: this.config.criterionName,
          score: 1,
          reasoning:
            'No keywords to find (list was empty or became empty after processing). Evaluation assumes 100% coverage.',
          evaluatorType: this.type,
        },
      ];
    }

    let sourceText = getInputText(input, this.config.sourceTextField as any);

    if (sourceText === undefined) {
      return [
        {
          criterionName: this.config.criterionName,
          score: 'error', // Changed from 0 to 'error'
          reasoning: `Evaluation failed: Source text field '${this.config.sourceTextField}' did not yield a string or was not found.`,
          evaluatorType: this.type,
          error: `Source text field ${this.config.sourceTextField} not found in input or content is not a string.`,
        },
      ];
    }

    if (this.config.normalizeWhitespaceForSource) {
      sourceText = sourceText.trim().replace(/\s+/g, ' ');
    }
    if (!this.config.caseSensitive) {
      sourceText = sourceText.toLowerCase();
    }

    let foundCount = 0;
    const foundKeywords: string[] = [];
    const missedKeywords: string[] = [];

    for (const keyword of keywordsToFind) {
      const pattern = new RegExp(
        `\\b${keyword.replace(/[\\.\\*\\?\\^\\$\\{\\}\\(\\)\\|\\\\[\\\\]\\\\]/g, '\\\\$&')}\\b`,
        this.config.caseSensitive ? '' : 'i',
      );
      if (pattern.test(sourceText)) {
        foundCount++;
        foundKeywords.push(keyword);
      } else {
        missedKeywords.push(keyword);
      }
    }

    const score = keywordsToFind.length > 0 ? foundCount / keywordsToFind.length : 1;
    const reasoning = `Found ${foundCount} out of ${keywordsToFind.length} keywords. Coverage: ${(score * 100).toFixed(2)}%. Found: [${foundKeywords.join(', ')}]. Missed: [${missedKeywords.join(', ')}]. Source text (processed): "${sourceText.substring(0, 200)}${sourceText.length > 200 ? '...' : ''}".`;

    return [
      {
        criterionName: this.config.criterionName,
        score: score,
        reasoning: reasoning,
        evaluatorType: this.type,
      },
    ];
  }
}
