import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import { SorensenDice, JaroWinkler, Levenshtein } from 'string-comparisons';
import { getInputText } from '../../utils/input-text-extractor';
// We'll import from 'string-comparisons' once we use it.

/**
 * Configuration for the LexicalSimilarityEvaluator.
 */
export interface LexicalSimilarityEvaluatorConfig {
  /** The name of the criterion this evaluator assesses (e.g., "LexicalMatchToExpected"). */
  criterionName: string;
  /**
   * The string similarity algorithm to use.
   * 'sorensen-dice' is a good default for general lexical similarity.
   * 'jaro-winkler' is often better for short strings, like names.
   * 'levenshtein' calculates edit distance, which needs normalization to a similarity score.
   */
  algorithm?: 'sorensen-dice' | 'jaro-winkler' | 'levenshtein'; // Add more as supported
  /** Whether the comparison should be case-sensitive. Defaults to false. */
  caseSensitive?: boolean;
  /** Whether to normalize whitespace (trim and reduce multiple spaces to one). Defaults to true. */
  normalizeWhitespace?: boolean;
  /**
   * Field in EvaluationInput to use as the primary string for comparison.
   * Can be a top-level field like 'response', 'prompt', 'groundTruth',
   * or a dot-notation path e.g., 'response.content[0].text', 'context.someKey.value'.
   * Defaults to 'response'.
   */
  sourceField?:
    | 'response'
    | 'prompt'
    | 'groundTruth'
    | `response.${string}`
    | `groundTruth.${string}`
    | `context.${string}`;
  /**
   * Field in EvaluationInput to use as the reference string for comparison.
   * Can be a top-level field like 'response', 'prompt', 'groundTruth',
   * or a dot-notation path e.g., 'response.content[0].text', 'context.someKey.value'.
   * Defaults to 'groundTruth'.
   */
  referenceField?:
    | 'response'
    | 'prompt'
    | 'groundTruth'
    | `response.${string}`
    | `groundTruth.${string}`
    | `context.${string}`;
}

/**
 * Evaluates the lexical similarity between two strings from the EvaluationInput
 * using a configured string similarity algorithm.
 */
export class LexicalSimilarityEvaluator implements Evaluator {
  public readonly type = 'LexicalSimilarity';
  private config: Required<LexicalSimilarityEvaluatorConfig>;

  constructor(config: LexicalSimilarityEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[LexicalSimilarityEvaluator] criterionName must be provided and non-empty.');
    }
    // The getInputText utility and subsequent checks for undefined handle the case where fields might not yield strings.

    this.config = {
      criterionName: config.criterionName,
      algorithm: config.algorithm || 'sorensen-dice',
      caseSensitive: config.caseSensitive === undefined ? false : config.caseSensitive,
      normalizeWhitespace:
        config.normalizeWhitespace === undefined ? true : config.normalizeWhitespace,
      sourceField: config.sourceField || 'response',
      referenceField: config.referenceField || 'groundTruth',
    };
  }

  async evaluate(
    input: EvaluationInput,
    criteria: EvaluationCriteria[],
  ): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find((c) => c.name === this.config.criterionName);
    if (!targetCriterion) {
      // If this evaluator is specifically configured for a criterion not in the input list,
      // it means this evaluator instance wasn't meant for any of the currently evaluated criteria.
      // This might happen if an evaluator instance is created but not all of its potential
      // criteria are included in a specific EvaluationInput.
      // console.warn(`[LexicalSimilarityEvaluator] Configured criterion "${this.config.criterionName}" not found in input.criteria. This evaluator will not produce a result for this run.`);
      return []; // No relevant criterion for this evaluator instance in this specific run.
    }

    const sourceText = getInputText(input, this.config.sourceField as string | undefined);
    const referenceText = getInputText(input, this.config.referenceField as string | undefined);

    if (sourceText === undefined || referenceText === undefined) {
      return [
        {
          criterionName: this.config.criterionName,
          score: 0,
          reasoning: `Evaluation failed: Source text (from '${this.config.sourceField}') or reference text (from '${this.config.referenceField}') could not be extracted as string. Source undefined: ${sourceText === undefined}, Reference undefined: ${referenceText === undefined}.`,
          evaluatorType: this.type,
          error: 'Invalid input: required text fields not found or not extractable as string.',
        },
      ];
    }

    let score = 0;
    let reasoning = `Comparing '${this.config.sourceField}' with '${this.config.referenceField}' using ${this.config.algorithm}.`;

    try {
      let processedSource = sourceText;
      let processedReference = referenceText;

      if (!this.config.caseSensitive) {
        processedSource = processedSource.toLowerCase();
        processedReference = processedReference.toLowerCase();
        reasoning += ' Case-insensitive comparison.';
      }
      if (this.config.normalizeWhitespace) {
        processedSource = processedSource.trim().replace(/\s+/g, ' ');
        processedReference = processedReference.trim().replace(/\s+/g, ' ');
        reasoning += ' Whitespace normalized.';
      }

      switch (this.config.algorithm) {
        case 'sorensen-dice':
          score = SorensenDice.similarity(processedSource, processedReference);
          reasoning += ` Sørensen-Dice similarity: ${score.toFixed(4)}.`;
          break;
        case 'jaro-winkler':
          score = JaroWinkler.similarity(processedSource, processedReference);
          reasoning += ` Jaro-Winkler similarity: ${score.toFixed(4)}.`;
          break;
        case 'levenshtein':
          const distance = Levenshtein.similarity(processedSource, processedReference); // This lib's .similarity IS distance for Levenshtein
          if (processedSource.length === 0 && processedReference.length === 0) {
            score = 1;
          } else if (processedSource.length === 0 || processedReference.length === 0) {
            score = 0;
          } else {
            const maxLength = Math.max(processedSource.length, processedReference.length);
            score = 1 - distance / maxLength;
          }
          score = Math.max(0, Math.min(1, score));
          reasoning += ` Levenshtein distance: ${distance}, Normalized similarity: ${score.toFixed(4)}.`;
          break;
        default: // Should ideally be caught by config validation if algorithm is unknown
          score = SorensenDice.similarity(processedSource, processedReference);
          reasoning += ` Defaulted to Sørensen-Dice similarity: ${score.toFixed(4)}.`;
      }

      reasoning += ` Processed source: "${processedSource.substring(0, 100)}${processedSource.length > 100 ? '...' : ''}", Processed reference: "${processedReference.substring(0, 100)}${processedReference.length > 100 ? '...' : ''}".`;
    } catch (e: any) {
      return [
        {
          criterionName: this.config.criterionName,
          score: 0,
          reasoning: `Error during similarity calculation: ${e.message}`,
          evaluatorType: this.type,
          error: e.message,
        },
      ];
    }

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
