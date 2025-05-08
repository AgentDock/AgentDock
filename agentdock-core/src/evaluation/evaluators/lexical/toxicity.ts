import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import { getInputText } from '../../utils/input-text-extractor';

/**
 * Configuration for the ToxicityEvaluator.
 */
export interface ToxicityEvaluatorConfig {
  /** The name of the criterion this evaluator assesses (e.g., "IsNotToxic"). */
  criterionName: string;
  /** An array of words or phrases considered toxic. */
  toxicTerms: string[];
  /** 
   * Field in EvaluationInput to use as the text to analyze. 
   * Can be a top-level field like 'response', 'prompt', 'groundTruth', 
   * or a dot-notation path e.g., 'response.content[0].text', 'context.someKey.value'.
   * Defaults to 'response'.
   */
  sourceTextField?: 'response' | 'prompt' | 'groundTruth' | `response.${string}` | `groundTruth.${string}` | `context.${string}`;
  /** Whether matching should be case-sensitive. Defaults to false. */
  caseSensitive?: boolean;
  /** 
   * Whether to match whole words only or allow substring matches.
   * Defaults to true (uses word boundaries in regex).
   */
  matchWholeWord?: boolean;
}

/**
 * Evaluates a source text for the presence of configured toxic terms.
 * Returns true (passes) if no toxic terms are found, false otherwise.
 */
export class ToxicityEvaluator implements Evaluator {
  public readonly type = 'Toxicity';
  private config: Required<ToxicityEvaluatorConfig>;
  private regexToTermMap: Map<RegExp, string>;

  constructor(config: ToxicityEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[ToxicityEvaluator] criterionName must be provided and non-empty.');
    }
    if (!config.toxicTerms || config.toxicTerms.length === 0) {
      throw new Error('[ToxicityEvaluator] toxicTerms array must be provided and non-empty.');
    }

    this.config = {
      criterionName: config.criterionName,
      toxicTerms: [...config.toxicTerms], // Clone to avoid external modification
      sourceTextField: config.sourceTextField || 'response',
      caseSensitive: config.caseSensitive === undefined ? false : config.caseSensitive,
      matchWholeWord: config.matchWholeWord === undefined ? true : config.matchWholeWord,
    };

    // Pre-compile regexes and map them to their original terms
    this.regexToTermMap = new Map<RegExp, string>();
    this.config.toxicTerms.forEach(term => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = this.config.caseSensitive ? 'g' : 'gi'; // global, ignoreCase
      const regex = new RegExp(this.config.matchWholeWord ? `\\b${escapedTerm}\\b` : escapedTerm, flags);
      this.regexToTermMap.set(regex, term);
    });
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);
    if (!targetCriterion) {
      return [];
    }

    const sourceText = getInputText(input, this.config.sourceTextField as string | undefined);

    if (sourceText === undefined) {
      return [{
        criterionName: this.config.criterionName,
        score: false,
        reasoning: `Evaluation failed: Source text field '${this.config.sourceTextField}' did not yield a string.`,
        evaluatorType: this.type,
        error: 'Invalid input type for toxicity analysis.',
      }];
    }

    const foundToxicTerms: string[] = [];
    // Iterate over the map's keys (RegExp objects)
    for (const regex of this.regexToTermMap.keys()) {
      regex.lastIndex = 0; // Reset regex state for global matches
      if (regex.test(sourceText)) {
        const matchedTerm = this.regexToTermMap.get(regex);
        if (matchedTerm && !foundToxicTerms.includes(matchedTerm)) {
          foundToxicTerms.push(matchedTerm);
        }
      }
    }

    const isNotToxic = foundToxicTerms.length === 0;
    let reasoning = `Toxicity check for field '${this.config.sourceTextField}'. `;
    if (isNotToxic) {
      reasoning += 'No configured toxic terms found.';
    } else {
      reasoning += `Found toxic terms: [${foundToxicTerms.join(', ')}].`;
    }
    reasoning += ` Configured terms: [${this.config.toxicTerms.join(', ')}]. Case sensitive: ${this.config.caseSensitive}, Match whole word: ${this.config.matchWholeWord}.`;

    return [{
      criterionName: this.config.criterionName,
      score: isNotToxic,
      reasoning: reasoning,
      evaluatorType: this.type,
      metadata: { foundToxicTerms }
    }];
  }
} 