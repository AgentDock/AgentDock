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
   * Defaults to 'response'.
   */
  sourceTextField?: 'response' | 'prompt';
  /** Whether keyword matching should be case-sensitive. Defaults to false. */
  caseSensitive?: boolean;
  /** Whether to normalize whitespace in the source text before matching. Defaults to true. */
  normalizeWhitespaceForSource?: boolean;
  /** How to treat keywords when `keywordsSourceField` is 'groundTruth' and it's a string: 'exact' or 'split-comma'. Defaults to 'split-comma'. */
  groundTruthKeywordMode?: 'exact' | 'split-comma';
}

/**
 * Evaluates how many of a list of expected keywords are present in a source text.
 */
export class KeywordCoverageEvaluator implements Evaluator {
  public readonly type = 'KeywordCoverage';
  private config: Required<Omit<KeywordCoverageEvaluatorConfig, 'expectedKeywords' | 'keywordsSourceField'> & Pick<KeywordCoverageEvaluatorConfig, 'expectedKeywords' | 'keywordsSourceField'> >;

  constructor(config: KeywordCoverageEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[KeywordCoverageEvaluator] criterionName must be provided and non-empty.');
    }

    const keywordsSource = config.keywordsSourceField || 'config';
    if (keywordsSource === 'config' && (!config.expectedKeywords || config.expectedKeywords.length === 0)) {
      throw new Error('[KeywordCoverageEvaluator] expectedKeywords must be provided in config when keywordsSourceField is \'config\' or default.');
    }
    if (keywordsSource.startsWith('context.') && keywordsSource.split('.').length < 2) {
        throw new Error("[KeywordCoverageEvaluator] Invalid keywordsSourceField format for context. Expected 'context.fieldName'.");
    }

    this.config = {
      criterionName: config.criterionName,
      expectedKeywords: (keywordsSource === 'config') ? config.expectedKeywords! : (config.expectedKeywords || []),
      keywordsSourceField: keywordsSource,
      sourceTextField: config.sourceTextField || 'response',
      caseSensitive: config.caseSensitive === undefined ? false : config.caseSensitive,
      normalizeWhitespaceForSource: config.normalizeWhitespaceForSource === undefined ? true : config.normalizeWhitespaceForSource,
      groundTruthKeywordMode: config.groundTruthKeywordMode || 'split-comma',
    };
  }

  private getKeywords(input: EvaluationInput): string[] {
    let keywords: string[] = [];
    const source = this.config.keywordsSourceField;

    if (source === 'config') {
      keywords = this.config.expectedKeywords || [];
    } else if (source === 'groundTruth') {
      if (Array.isArray(input.groundTruth)) {
        keywords = input.groundTruth.filter(k => typeof k === 'string');
      } else {
        // Try to get groundTruth as text using the utility
        const gtText = getInputText(input, 'groundTruth');
        if (gtText) {
          if (this.config.groundTruthKeywordMode === 'split-comma') {
            keywords = gtText.split(',').map(k => k.trim()).filter(k => k.length > 0);
          } else { // 'exact'
            keywords = [gtText];
          }
        }
      }
    } else if (source && source.startsWith('context.')) {
      // For context, try to get text using utility. If it returns a string, parse it.
      // If the context field directly holds an array, that specific handling is more complex
      // and might need dedicated logic if getInputText doesn't fit.
      // For now, assume context source field for keywords should resolve to a parsable string.
      const contextText = getInputText(input, source as `context.${string}`);
      if (contextText) {
         keywords = contextText.split(',').map(k => k.trim()).filter(k => k.length > 0);
      } else {
        // Fallback or specific handling if context field is an array directly
        const fieldName = source.substring('context.'.length);
        const contextValue = input.context?.[fieldName];
        if (Array.isArray(contextValue)) {
          keywords = contextValue.filter(k => typeof k === 'string');
        }
      }
    }
    
    if (!this.config.caseSensitive) {
        keywords = keywords.map(k => k.toLowerCase());
    }
    return keywords.filter(k => k.length > 0);
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);
    if (!targetCriterion) {
      return [];
    }

    const keywordsToFind = this.getKeywords(input);
    // Use getInputText for the source text field
    let sourceText = getInputText(input, this.config.sourceTextField as string | undefined);

    if (sourceText === undefined) {
      return [{
        criterionName: this.config.criterionName,
        score: 0,
        reasoning: `Evaluation failed: Source text field '${this.config.sourceTextField}' did not yield a string.`,
        evaluatorType: this.type,
        error: 'Invalid input type for source text.',
      }];
    }

    if (keywordsToFind.length === 0) {
      return [{
        criterionName: this.config.criterionName,
        score: 1, 
        reasoning: 'No keywords to find. Ensure keywordsSourceField and its content are correctly specified.',
        evaluatorType: this.type,
      }];
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
      if (sourceText.includes(keyword)) {
        foundCount++;
        foundKeywords.push(keyword);
      } else {
        missedKeywords.push(keyword);
      }
    }

    const score = keywordsToFind.length > 0 ? foundCount / keywordsToFind.length : 1;
    const reasoning = `Found ${foundCount} out of ${keywordsToFind.length} keywords. Coverage: ${(score * 100).toFixed(2)}%. Found: [${foundKeywords.join(', ')}]. Missed: [${missedKeywords.join(', ')}]. Source text (processed): "${sourceText.substring(0, 200)}${sourceText.length > 200 ? '...' : ''}".`;
    
    return [{
      criterionName: this.config.criterionName,
      score: score,
      reasoning: reasoning,
      evaluatorType: this.type,
    }];
  }
} 