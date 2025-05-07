import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import { SorensenDice, JaroWinkler, Levenshtein } from 'string-comparisons';
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
   * Defaults to 'response'.
   */
  sourceField?: 'response' | 'prompt'; // Or other relevant string fields from EvaluationInput
  /** 
   * Field in EvaluationInput to use as the reference string for comparison. 
   * Defaults to 'groundTruth'.
   */
  referenceField?: 'groundTruth' | 'prompt'; // Or other relevant string fields
}

/**
 * Evaluates the lexical similarity between two strings from the EvaluationInput
 * using a configured string similarity algorithm.
 */
export class LexicalSimilarityEvaluator implements Evaluator {
  public readonly type = 'LexicalSimilarity';
  private config: Required<LexicalSimilarityEvaluatorConfig>; // Store processed config with defaults

  constructor(config: LexicalSimilarityEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[LexicalSimilarityEvaluator] criterionName must be provided and non-empty.');
    }
    if (!config.sourceField && !config.referenceField && (!config.criterionName.toLowerCase().includes('response') || !config.criterionName.toLowerCase().includes('groundtruth'))) {
        // A bit of a heuristic: if no fields are specified, the criterion name should give a hint.
        // This is not a robust check, primary validation should be on field presence.
    }
    // TODO: Add validation that sourceField and referenceField point to string properties in EvaluationInput,
    // or ensure that the getFieldContent method handles non-string cases gracefully.


    this.config = {
      criterionName: config.criterionName,
      algorithm: config.algorithm || 'sorensen-dice',
      caseSensitive: config.caseSensitive === undefined ? false : config.caseSensitive,
      normalizeWhitespace: config.normalizeWhitespace === undefined ? true : config.normalizeWhitespace,
      sourceField: config.sourceField || 'response',
      referenceField: config.referenceField || 'groundTruth',
    };
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);
    if (!targetCriterion) {
      // If this evaluator is specifically configured for a criterion not in the input list,
      // it means this evaluator instance wasn't meant for any of the currently evaluated criteria.
      // This might happen if an evaluator instance is created but not all of its potential
      // criteria are included in a specific EvaluationInput.
      // console.warn(`[LexicalSimilarityEvaluator] Configured criterion "${this.config.criterionName}" not found in input.criteria. This evaluator will not produce a result for this run.`);
      return []; // No relevant criterion for this evaluator instance in this specific run.
    }

    const sourceText = this.getFieldContent(input, this.config.sourceField);
    const referenceText = this.getFieldContent(input, this.config.referenceField);

    if (typeof sourceText !== 'string' || typeof referenceText !== 'string') {
      return [{
        criterionName: this.config.criterionName,
        score: 0, // Or handle as an error/specific score
        reasoning: `Evaluation failed: Source or reference field did not yield a string. Source type: ${typeof sourceText}, Reference type: ${typeof referenceText}. Source field: '${this.config.sourceField}', Reference field: '${this.config.referenceField}'.`,
        evaluatorType: this.type,
        error: 'Invalid input type for similarity comparison.',
      }];
    }

    let score = 0;
    let reasoning = `Comparing '${this.config.sourceField}' with '${this.config.referenceField}' using ${this.config.algorithm}.`;
    
    try {
      // Preprocessing
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
      
      let rawScore: number | undefined = undefined;

      switch (this.config.algorithm) {
        case 'sorensen-dice':
          score = SorensenDice.similarity(processedSource, processedReference);
          rawScore = score;
          reasoning += ` Sørensen-Dice similarity: ${score.toFixed(4)}.`;
          break;
        case 'jaro-winkler':
          // The library might export JaroWrinker based on its example, let's assume JaroWinkler is standard
          // or check the actual exports if this causes issues later.
          score = JaroWinkler.similarity(processedSource, processedReference);
          rawScore = score;
          reasoning += ` Jaro-Winkler similarity: ${score.toFixed(4)}.`;
          break;
        case 'levenshtein':
          const distance = Levenshtein.similarity(processedSource, processedReference); // This returns distance
          rawScore = distance;
          if (processedSource.length === 0 && processedReference.length === 0) {
            score = 1; // Both empty, perfect match
          } else if (processedSource.length === 0 || processedReference.length === 0) {
            score = 0; // One empty, other not, no similarity
          } else {
            const maxLength = Math.max(processedSource.length, processedReference.length);
            score = 1 - (distance / maxLength);
          }
          score = Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
          reasoning += ` Levenshtein distance: ${distance}, Normalized similarity: ${score.toFixed(4)}.`;
          break;
        default:
          // Should not happen due to config default, but as a fallback:
          score = SorensenDice.similarity(processedSource, processedReference);
          rawScore = score;
          reasoning += ` Defaulted to Sørensen-Dice similarity: ${score.toFixed(4)}.`;
      }

      reasoning += ` Processed source: "${processedSource}", Processed reference: "${processedReference}".`;

    } catch (e: any) {
      return [{
        criterionName: this.config.criterionName,
        score: 0,
        reasoning: `Error during similarity calculation: ${e.message}`,
        evaluatorType: this.type,
        error: e.message,
      }];
    }
    
    return [{
      criterionName: this.config.criterionName,
      score: score,
      reasoning: reasoning,
      evaluatorType: this.type,
    }];
  }

  private getFieldContent(input: EvaluationInput, fieldName: 'response' | 'prompt' | 'groundTruth'): string | any {
    switch (fieldName) {
      case 'response':
        // If response is an AgentMessage, try to get text from its content or contentParts
        if (typeof input.response === 'object' && input.response !== null && 'content' in input.response) {
          const message = input.response as any; // Cast to any to access potential content/contentParts
          if (message.contentParts && Array.isArray(message.contentParts) && message.contentParts.length > 0) {
            const textPart = message.contentParts.find((p: any) => p.type === 'text');
            return textPart ? textPart.text : (typeof message.content === 'string' ? message.content : '');
          }
          return typeof message.content === 'string' ? message.content : '';
        }
        return input.response; // Assumes string if not an AgentMessage-like object
      case 'prompt':
        return input.prompt;
      case 'groundTruth':
        return input.groundTruth;
      default:
        // This case should ideally not be reached if fieldName is typed correctly.
        // But as a fallback, try to access any property.
        return (input as any)[fieldName];
    }
  }
} 