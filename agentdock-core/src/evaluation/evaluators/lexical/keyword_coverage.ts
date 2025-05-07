import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';

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
      keywords = this.config.expectedKeywords;
    } else if (source === 'groundTruth') {
      if (Array.isArray(input.groundTruth)) {
        keywords = input.groundTruth.filter(k => typeof k === 'string');
      } else if (typeof input.groundTruth === 'string') {
        if (this.config.groundTruthKeywordMode === 'split-comma') {
          keywords = input.groundTruth.split(',').map(k => k.trim()).filter(k => k.length > 0);
        } else { // 'exact'
          keywords = [input.groundTruth];
        }
      }
    } else if (source && source.startsWith('context.')) {
      const fieldName = source.substring('context.'.length);
      const contextValue = input.context?.[fieldName];
      if (Array.isArray(contextValue)) {
        keywords = contextValue.filter(k => typeof k === 'string');
      } else if (typeof contextValue === 'string') {
         // For simplicity, if context field is string, treat as single keyword or comma-separated
         keywords = contextValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
      }
    }
    // Normalize keywords from input sources (case, whitespace) for consistent matching if evaluator is not case sensitive for source
    // This isn't strictly necessary if source text is also normalized, but good for robustness.
    // However, if keywords themselves contain significant casing/spacing, this might be too aggressive.
    // Let's apply case normalization to keywords if the source comparison is case-insensitive.
    if (!this.config.caseSensitive) {
        keywords = keywords.map(k => k.toLowerCase());
    }
    return keywords.filter(k => k.length > 0); // Ensure no empty strings from split etc.
  }

  private getFieldContent(input: EvaluationInput, fieldName: 'response' | 'prompt'): string | any {
    // (Reusing a similar helper from LexicalSimilarityEvaluator - consider moving to a util if shared more)
    switch (fieldName) {
      case 'response':
        if (typeof input.response === 'object' && input.response !== null && 'content' in input.response) {
          const message = input.response as any; 
          if (message.contentParts && Array.isArray(message.contentParts) && message.contentParts.length > 0) {
            const textPart = message.contentParts.find((p: any) => p.type === 'text');
            return textPart ? textPart.text : (typeof message.content === 'string' ? message.content : '');
          }
          return typeof message.content === 'string' ? message.content : '';
        }
        return input.response; 
      case 'prompt':
        return input.prompt;
      default:
        return (input as any)[fieldName];
    }
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);
    if (!targetCriterion) {
      return [];
    }

    const keywordsToFind = this.getKeywords(input);
    let sourceText = this.getFieldContent(input, this.config.sourceTextField || 'response');

    if (typeof sourceText !== 'string') {
      return [{
        criterionName: this.config.criterionName,
        score: 0,
        reasoning: `Evaluation failed: Source text field '${this.config.sourceTextField}' did not yield a string. Type: ${typeof sourceText}.`,
        evaluatorType: this.type,
        error: 'Invalid input type for source text.',
      }];
    }

    if (keywordsToFind.length === 0) {
      return [{
        criterionName: this.config.criterionName,
        score: 1, // Or 0, or specific error. If no keywords to find, is it 100% coverage or 0%?
                   // Let's say 100% as there are no expectations that were missed. Or perhaps an error/warning.
        reasoning: 'No keywords to find. Ensure keywordsSourceField and its content are correctly specified.',
        evaluatorType: this.type,
        // error: 'No keywords provided for coverage check.' // Alternative
      }];
    }

    if (this.config.normalizeWhitespaceForSource) {
      sourceText = sourceText.trim().replace(/\s+/g, ' ');
    }
    if (!this.config.caseSensitive) {
      sourceText = sourceText.toLowerCase();
      // Keywords are already lowercased in getKeywords if caseSensitive is false
    }

    let foundCount = 0;
    const foundKeywords: string[] = [];
    const missedKeywords: string[] = [];

    for (const keyword of keywordsToFind) {
      // If not case sensitive, keyword is already lowercased by getKeywords.
      // Source text is also lowercased if not case sensitive.
      if (sourceText.includes(keyword)) {
        foundCount++;
        foundKeywords.push(keyword);
      } else {
        missedKeywords.push(keyword);
      }
    }

    const score = keywordsToFind.length > 0 ? foundCount / keywordsToFind.length : 1; // Avoid division by zero, 1 if no keywords
    const reasoning = `Found ${foundCount} out of ${keywordsToFind.length} keywords. Coverage: ${(score * 100).toFixed(2)}%. Found: [${foundKeywords.join(', ')}]. Missed: [${missedKeywords.join(', ')}]. Source text (processed): "${sourceText.substring(0, 200)}${sourceText.length > 200 ? '...' : ''}".`;
    
    return [{
      criterionName: this.config.criterionName,
      score: score,
      reasoning: reasoning,
      evaluatorType: this.type,
    }];
  }
} 