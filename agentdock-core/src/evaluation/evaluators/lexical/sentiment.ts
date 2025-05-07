import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
import Sentiment from 'sentiment'; // Capital S for constructor
import { getInputText } from '../../utils/input-text-extractor';

/**
 * Configuration for the SentimentEvaluator.
 */
export interface SentimentEvaluatorConfig {
  /** The name of the criterion this evaluator assesses (e.g., "ResponseSentiment"). */
  criterionName: string;
  /** 
   * Field in EvaluationInput to use as the text to analyze. 
   * Defaults to 'response'.
   */
  sourceTextField?: 'response' | 'prompt';
  /** 
   * Specifies the type of output score to generate.
   * 'comparativeNormalized': The sentiment library's comparative score, normalized to a 0-1 range (default).
   *    (Original comparative is typically -5 to +5, so normalized: (score + 5) / 10)
   * 'rawScore': The raw AFINN score sum (can be any integer, positive or negative).
   * 'category': A string category: "positive", "negative", or "neutral".
   *             (e.g., comparative > 0.2 -> positive, < -0.2 -> negative, else neutral - thresholds can be defaults)
   */
  outputType?: 'comparativeNormalized' | 'rawScore' | 'category';
  // `language` option is available in the sentiment library, but we'll stick to 'en' implicitly for now.
  // `extras` option to add/overwrite words is also available but omitted for initial simplicity.

  /** Threshold for 'category' output type: comparative score above this is "positive". Defaults to 0.2. */
  positiveThreshold?: number;
  /** Threshold for 'category' output type: comparative score below this is "negative". Defaults to -0.2. */
  negativeThreshold?: number;
}

/**
 * Evaluates the sentiment of a source text using an AFINN-based library.
 */
export class SentimentEvaluator implements Evaluator {
  public readonly type = 'Sentiment'; // Simplified type name
  private config: Required<SentimentEvaluatorConfig>;
  private sentimentAnalyzer: Sentiment;

  constructor(config: SentimentEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[SentimentEvaluator] criterionName must be provided and non-empty.');
    }

    this.config = {
      criterionName: config.criterionName,
      sourceTextField: config.sourceTextField || 'response',
      outputType: config.outputType || 'comparativeNormalized',
      positiveThreshold: config.positiveThreshold === undefined ? 0.2 : config.positiveThreshold,
      negativeThreshold: config.negativeThreshold === undefined ? -0.2 : config.negativeThreshold,
    };

    if (this.config.negativeThreshold >= this.config.positiveThreshold && this.config.outputType === 'category') {
        throw new Error('[SentimentEvaluator] negativeThreshold must be less than positiveThreshold for category output.');
    }

    this.sentimentAnalyzer = new Sentiment();
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
        score: this.config.outputType === 'category' ? 'neutral' : 0, 
        reasoning: `Evaluation failed: Source text field '${this.config.sourceTextField}' did not yield a string.`,
        evaluatorType: this.type,
        error: 'Invalid input type for sentiment analysis.',
      }];
    }
    
    if (sourceText.trim() === '') {
        return [{
            criterionName: this.config.criterionName,
            score: this.config.outputType === 'category' ? 'neutral' : (this.config.outputType === 'comparativeNormalized' ? 0.5 : 0),
            reasoning: 'Source text is empty. Sentiment is considered neutral or baseline.',
            evaluatorType: this.type,
        }];
    }

    try {
      const analysisResult = this.sentimentAnalyzer.analyze(sourceText);
      let finalScore: number | string = 0;
      let reasoning = `Sentiment analysis of '${this.config.sourceTextField}'. Raw score: ${analysisResult.score}, Comparative: ${analysisResult.comparative.toFixed(4)}.`;

      switch (this.config.outputType) {
        case 'rawScore':
          finalScore = analysisResult.score;
          reasoning += ` Output type: rawScore.`;
          break;
        case 'category':
          if (analysisResult.comparative > this.config.positiveThreshold) {
            finalScore = 'positive';
          } else if (analysisResult.comparative < this.config.negativeThreshold) {
            finalScore = 'negative';
          } else {
            finalScore = 'neutral';
          }
          reasoning += ` Output type: category -> ${finalScore}. (PosThreshold: ${this.config.positiveThreshold}, NegThreshold: ${this.config.negativeThreshold}).`;
          break;
        case 'comparativeNormalized':
        default:
          // Normalize comparative score from [-5, 5] to [0, 1]
          // Assumes AFINN tokens are in [-5, 5] range. The library's comparative score is sum/tokens.
          // A single strong word can dominate. If all words are +5, comparative is +5.
          // If all words are -5, comparative is -5.
          finalScore = (analysisResult.comparative + 5) / 10;
          finalScore = Math.max(0, Math.min(1, finalScore)); // Clamp to [0, 1]
          reasoning += ` Output type: comparativeNormalized -> ${finalScore.toFixed(4)}.`;
          break;
      }

      return [{
        criterionName: this.config.criterionName,
        score: finalScore,
        reasoning: reasoning,
        evaluatorType: this.type,
        metadata: { // Include detailed sentiment breakdown in metadata
            rawScore: analysisResult.score,
            comparativeScore: analysisResult.comparative,
            positiveWords: analysisResult.positive,
            negativeWords: analysisResult.negative,
        }
      }];

    } catch (e: any) {
      return [{
        criterionName: this.config.criterionName,
        score: this.config.outputType === 'category' ? 'neutral' : 0,
        reasoning: `Error during sentiment analysis: ${e.message}`,
        evaluatorType: this.type,
        error: e.message,
      }];
    }
  }
} 