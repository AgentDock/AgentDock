import type {
  EvaluationInput,
  AggregatedEvaluationResult,
  EvaluationCriteria,
  Evaluator,
  EvaluationResult,
  EvaluationScale
} from '../types';
// Removed direct import of JsonFileStorageProvider here

// Import concrete evaluator types and their configs from the main evaluators export
import {
  RuleBasedEvaluator, type EvaluationRule,
  LLMJudgeEvaluator, type LLMJudgeConfig,
  NLPAccuracyEvaluator, type NLPAccuracyEvaluatorConfig,
  ToolUsageEvaluator, type ToolUsageEvaluatorConfig, // Added ToolUsage imports
  LexicalSimilarityEvaluator, type LexicalSimilarityEvaluatorConfig, // Added LexicalSimilarity imports
  KeywordCoverageEvaluator, type KeywordCoverageEvaluatorConfig, // Added
  SentimentEvaluator, type SentimentEvaluatorConfig, // Added
  ToxicityEvaluator, type ToxicityEvaluatorConfig // Added
} from '../evaluators';

/** Configuration for a rule-based evaluator within the run */
interface RuleBasedEvaluatorRunnerConfig { // Renamed for clarity if we distinguish runner config from direct evaluator config
  type: 'RuleBased';
  rules: EvaluationRule[];
}

/** Configuration for an LLM judge evaluator within the run */
interface LLMJudgeEvaluatorRunnerConfig { // Renamed for clarity
  type: 'LLMJudge';
  config: LLMJudgeConfig;
}

/** Configuration for an NLP Accuracy evaluator within the run */
interface NLPAccuracyEvaluatorRunnerConfig { // New interface for the runner
  type: 'NLPAccuracy';
  config: NLPAccuracyEvaluatorConfig; // The actual config needed by NLPAccuracyEvaluator constructor
}

/** Configuration for a Tool Usage evaluator within the run */
interface ToolUsageEvaluatorRunnerConfig { // New interface for the runner
  type: 'ToolUsage';
  config: ToolUsageEvaluatorConfig; // The actual config needed by ToolUsageEvaluator constructor
}

/** Configuration for a Lexical Similarity evaluator within the run */
interface LexicalSimilarityEvaluatorRunnerConfig {
  type: 'LexicalSimilarity';
  config: LexicalSimilarityEvaluatorConfig;
}

/** Configuration for a Keyword Coverage evaluator within the run */
interface KeywordCoverageEvaluatorRunnerConfig {
  type: 'KeywordCoverage';
  config: KeywordCoverageEvaluatorConfig;
}

/** Configuration for a Sentiment evaluator within the run */
interface SentimentEvaluatorRunnerConfig {
  type: 'Sentiment';
  config: SentimentEvaluatorConfig;
}

/** Configuration for a Toxicity evaluator within the run */
interface ToxicityEvaluatorRunnerConfig {
  type: 'Toxicity';
  config: ToxicityEvaluatorConfig;
}

// Union type for possible evaluator configurations
type EvaluatorConfig = 
  | RuleBasedEvaluatorRunnerConfig 
  | LLMJudgeEvaluatorRunnerConfig 
  | NLPAccuracyEvaluatorRunnerConfig
  | ToolUsageEvaluatorRunnerConfig // Added to union
  | LexicalSimilarityEvaluatorRunnerConfig // Added to union
  | KeywordCoverageEvaluatorRunnerConfig // Added to union
  | SentimentEvaluatorRunnerConfig // Added to union
  | ToxicityEvaluatorRunnerConfig; // Added to union

/**
 * Configuration for a specific evaluation run.
 */
export interface EvaluationRunConfig {
  /** An array of evaluator configurations to instantiate and run. */
  evaluatorConfigs: EvaluatorConfig[];
  /** 
   * Optional server-side only storage provider to persist the evaluation results.
   * This will be called with the AggregatedEvaluationResult.
   * Example: An instance of JsonFileStorageProvider (imported directly by server-side script).
   */
  storageProvider_FOR_SERVER_USE_ONLY?: { saveResult: (result: AggregatedEvaluationResult) => Promise<void> };
  /** Optional run-level metadata to include in the aggregated result. */
  metadata?: Record<string, any>;
  /** Optional settings for specific evaluators, keyed by evaluator type (if needed beyond individual configs). */
  // evaluatorSettings?: Record<string, any>; // Maybe remove if configs are sufficient
  // TODO: Add other runner-specific settings like aggregation strategy, error handling policy?
}

/**
 * Validates the evaluator configurations.
 * @param evaluatorConfigs Array of evaluator configurations.
 * @throws Error if any configuration is invalid.
 */
function validateEvaluatorConfigs(evaluatorConfigs: EvaluatorConfig[]): void {
  if (!Array.isArray(evaluatorConfigs) || evaluatorConfigs.length === 0) {
    throw new Error('[EvaluationRunner] evaluatorConfigs must be a non-empty array.');
  }

  for (const [index, config] of evaluatorConfigs.entries()) {
    if (!config || !config.type) {
      throw new Error(`[EvaluationRunner] Invalid configuration at index ${index}: type is missing.`);
    }
    switch (config.type) {
      case 'RuleBased':
        if (!Array.isArray(config.rules) || config.rules.length === 0) {
          throw new Error(`[EvaluationRunner] RuleBasedEvaluator config at index ${index} requires a non-empty 'rules' array.`);
        }
        // Further validation for each rule can be added here if needed
        break;
      case 'LLMJudge':
        if (!config.config) {
          throw new Error(`[EvaluationRunner] LLMJudgeEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (!config.config.llm || typeof (config.config.llm as any).getModel !== 'function') {
          throw new Error(`[EvaluationRunner] LLMJudgeEvaluator 'config.llm' at index ${index} must be a CoreLLM instance (or provide a getModel method).`);
        }
        if (typeof config.config.promptTemplate !== 'string' || config.config.promptTemplate.trim() === '') {
          throw new Error(`[EvaluationRunner] LLMJudgeEvaluator 'config.promptTemplate' at index ${index} must be a non-empty string.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] LLMJudgeEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        break;
      case 'NLPAccuracy': // Added case for NLPAccuracy
        if (!config.config) {
          throw new Error(`[EvaluationRunner] NLPAccuracyEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (!config.config.embeddingModel) { // Basic check for embeddingModel
          throw new Error(`[EvaluationRunner] NLPAccuracyEvaluator 'config.embeddingModel' at index ${index} must be provided.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] NLPAccuracyEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        break;
      case 'ToolUsage': // Added case for ToolUsage
        if (!config.config) {
          throw new Error(`[EvaluationRunner] ToolUsageEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (!Array.isArray(config.config.rules) || config.config.rules.length === 0) {
          throw new Error(`[EvaluationRunner] ToolUsageEvaluator config at index ${index} requires a non-empty 'rules' array in its config.`);
        }
        // TODO: Could add validation for each rule within config.config.rules here
        break;
      case 'LexicalSimilarity': // Added case for LexicalSimilarity
        if (!config.config) {
          throw new Error(`[EvaluationRunner] LexicalSimilarityEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] LexicalSimilarityEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        // Optional: Add more specific validation for sourceField, referenceField, algorithm if needed
        break;
      case 'KeywordCoverage': // Added
        if (!config.config) {
          throw new Error(`[EvaluationRunner] KeywordCoverageEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] KeywordCoverageEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        // Add more validation for KeywordCoverageEvaluatorConfig if needed (e.g. expectedKeywords based on keywordsSourceField)
        if ((config.config.keywordsSourceField === 'config' || !config.config.keywordsSourceField) && (!config.config.expectedKeywords || config.config.expectedKeywords.length === 0)) {
            throw new Error(`[EvaluationRunner] KeywordCoverageEvaluator config at index ${index} requires 'expectedKeywords' when source is 'config'.`);
        }
        break;
      case 'Sentiment': // Added
        if (!config.config) {
          throw new Error(`[EvaluationRunner] SentimentEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] SentimentEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        // Add more validation for SentimentEvaluatorConfig if needed
        if (config.config.outputType === 'category' && config.config.negativeThreshold !== undefined && config.config.positiveThreshold !== undefined && config.config.negativeThreshold >= config.config.positiveThreshold) {
            throw new Error(`[EvaluationRunner] SentimentEvaluator config at index ${index} has negativeThreshold >= positiveThreshold for category output.`);
        }
        break;
      case 'Toxicity': // Added
        if (!config.config) {
          throw new Error(`[EvaluationRunner] ToxicityEvaluator config at index ${index} is missing the 'config' object.`);
        }
        if (typeof config.config.criterionName !== 'string' || config.config.criterionName.trim() === '') {
          throw new Error(`[EvaluationRunner] ToxicityEvaluator 'config.criterionName' at index ${index} must be a non-empty string.`);
        }
        if (!config.config.toxicTerms || config.config.toxicTerms.length === 0) {
            throw new Error(`[EvaluationRunner] ToxicityEvaluator config at index ${index} requires a non-empty 'toxicTerms' array.`);
        }
        break;
      default:
        // This case handles any unknown types if EvaluatorConfig is extended without updating the switch
        // The type assertion helps catch this at compile time if possible, but runtime check is good too.
        const _exhaustiveCheck: never = config;
        throw new Error(`[EvaluationRunner] Unknown evaluator type '${(_exhaustiveCheck as any).type}' at index ${index}.`);
    }
  }
}

/**
 * Normalizes a raw evaluation score to a numeric value (typically 0-1 range for comparable aggregation),
 * based on its original scale.
 * Returns null if the score cannot be meaningfully normalized to a number for aggregation.
 *
 * @param rawScore The raw score from an EvaluationResult (number, boolean, or string).
 * @param scale The EvaluationScale of the criterion this score pertains to.
 * @returns A normalized numeric score (ideally 0-1), or null.
 */
function normalizeEvaluationScore(rawScore: EvaluationResult['score'], scale: EvaluationScale): number | null {
  if (typeof rawScore === 'number') {
    switch (scale) {
      case 'likert5':
        // Ensure it's a valid Likert score (1-5), then normalize to 0-1
        if (rawScore >= 1 && rawScore <= 5) {
          return (rawScore - 1) / 4;
        }
        console.warn(`[EvaluationRunner] Invalid Likert5 score for normalization: ${rawScore}. Expected 1-5.`);
        return null; 
      case 'numeric':
        // For numeric, we could assume it's already normalized (0-1) or needs a defined range.
        // For now, let's return it if it's a number. If it's outside 0-1, weighted average will reflect its magnitude.
        // A more advanced system might require min/max for 'numeric' scales to normalize them to 0-1.
        // Or, we could clamp/warn if it's outside a typical normalized range like 0-1 or 0-100.
        // Let's simply return it as is for now. Or, to enforce 0-1 for consistent aggregation:
        if (rawScore >= 0 && rawScore <= 1) return rawScore;
        // If we want to allow other numeric ranges but normalize them, we need more info (e.g. percentage out of 100)
        // For this iteration, let's only accept 0-1 for 'numeric' or return null to exclude from simple 0-1 aggregation.
        // Alternative: just return rawScore and let weights handle it. For now, stricter for 0-1 aggregation goal.
        // console.warn(`[EvaluationRunner] Numeric score ${rawScore} is outside 0-1. Consider if it needs normalization for aggregation.`);
        // return rawScore; // Option 1: use as is
        if (rawScore >= 0 && rawScore <=100) return rawScore / 100; // Option 2: assume it's a percentage if > 1
        console.warn(`[EvaluationRunner] Numeric score ${rawScore} cannot be reliably normalized to 0-1 range for aggregation.`);
        return null; 
      default:
        // If scale is binary, pass/fail but score is a number (e.g. 0 or 1 already)
        if ((scale === 'binary' || scale === 'pass/fail') && (rawScore === 0 || rawScore === 1)) {
            return rawScore;
        }
        console.warn(`[EvaluationRunner] Numeric score ${rawScore} received for non-numeric/likert5 scale '${scale}'. Cannot reliably normalize.`);
        return null;
    }
  }

  if (typeof rawScore === 'boolean') {
    if (scale === 'binary' || scale === 'pass/fail') {
      return rawScore ? 1 : 0;
    }
    console.warn(`[EvaluationRunner] Boolean score received for scale '${scale}'. Normalizing true to 1, false to 0.`);
    return rawScore ? 1 : 0; // Default for other scales if boolean is given
  }

  if (typeof rawScore === 'string') {
    const lowerScore = rawScore.toLowerCase();
    if (scale === 'binary' || scale === 'pass/fail') {
      if ([ 'true', 'pass', 'yes', '1'].includes(lowerScore)) return 1;
      if ([ 'false', 'fail', 'no', '0'].includes(lowerScore)) return 0;
      return null; // Cannot parse string to boolean for these scales
    }
    // For likert5 or numeric, try to parse string to number
    if (scale === 'likert5' || scale === 'numeric') {
      const num = parseFloat(rawScore);
      if (!isNaN(num)) {
        // Recursively call to apply numeric scale logic (like Likert range check or 0-1 for numeric)
        return normalizeEvaluationScore(num, scale); 
      }
    }
    return null; // String score for a scale that isn't binary/passfail and isn't parsable to number
  }
  
  // If score is of any other type or not handled above.
  console.warn(`[EvaluationRunner] Score of type ${typeof rawScore} with value '${rawScore}' could not be normalized for scale '${scale}'.`);
  return null;
}

/**
 * Orchestrates the execution of an evaluation run.
 *
 * @param input The data and context for the evaluation.
 * @param config The configuration specifying how the evaluation should be run.
 * @returns A promise resolving to the aggregated evaluation results.
 */
export async function runEvaluation(
  input: EvaluationInput,
  config: EvaluationRunConfig
): Promise<AggregatedEvaluationResult> {
  const startTime = Date.now();
  console.log(`[EvaluationRunner] Starting evaluation run for agent ${input.agentId || 'unknown'} session ${input.sessionId || 'unknown'}...`);

  // Destructure with the new storage provider name
  const {
    evaluatorConfigs,
    storageProvider_FOR_SERVER_USE_ONLY: storageProvider, // Use the new name
    metadata: runMetadata = {},
  } = config;

  // Removed all dynamic import and default instantiation logic for JsonFileStorageProvider
  // The runner now only uses the provider if it's explicitly passed in.

  // Validate configurations before proceeding
  try {
    validateEvaluatorConfigs(evaluatorConfigs);
  } catch (error: any) {
    console.error('[EvaluationRunner] Configuration validation failed:', error.message);
    // Consider how to surface this error. For now, rethrow to halt execution.
    throw error; 
  }

  const allResults: EvaluationResult[] = [];
  const errors: { evaluatorType: string, error: string }[] = [];
  const instantiatedEvaluatorTypes: string[] = []; // For snapshot

  const evaluationPromises = evaluatorConfigs.map(async (evalConfig) => {
    let evaluator: Evaluator;
    let evaluatorType: string = evalConfig.type;
    try {
      switch (evalConfig.type) { // Changed from if/else to switch for clarity and extensibility
        case 'RuleBased':
          evaluator = new RuleBasedEvaluator(evalConfig.rules);
          break;
        case 'LLMJudge':
          evaluator = new LLMJudgeEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        case 'NLPAccuracy': // Added case for NLPAccuracy
          evaluator = new NLPAccuracyEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        case 'ToolUsage': // Added case for ToolUsage
          evaluator = new ToolUsageEvaluator(evalConfig.config);
          // evaluatorType remains just 'ToolUsage' as it can handle multiple criteria via rules
          break;
        case 'LexicalSimilarity': // Added case for LexicalSimilarity
          evaluator = new LexicalSimilarityEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        case 'KeywordCoverage': // Added
          evaluator = new KeywordCoverageEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        case 'Sentiment': // Added
          evaluator = new SentimentEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        case 'Toxicity': // Added
          evaluator = new ToxicityEvaluator(evalConfig.config);
          evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`;
          break;
        default:
          // This will be caught by the exhaustive check in validateEvaluatorConfigs if a new type is added
          // but not handled here. However, for safety:
          const _exhaustiveCheck: never = evalConfig;
          throw new Error(`Unknown evaluator type specified in config: ${(_exhaustiveCheck as any).type}`);
      }
      instantiatedEvaluatorTypes.push(evaluatorType);

      console.log(`[EvaluationRunner] Running evaluator: ${evaluatorType}`);
      const evaluatorResults = await evaluator.evaluate(input, input.criteria);
      console.log(`[EvaluationRunner] Evaluator ${evaluatorType} completed with ${evaluatorResults.length} results.`);
      return evaluatorResults;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[EvaluationRunner] Evaluator ${evaluatorType} failed:`, errorMessage);
      errors.push({ evaluatorType: evaluatorType, error: errorMessage });
      return []; // Return empty array on error for this evaluator
    }
  });

  // Wait for all evaluators to complete
  const resultsFromAllEvaluators = await Promise.all(evaluationPromises);
  resultsFromAllEvaluators.forEach(resultSet => allResults.push(...resultSet));

  // --- Aggregation --- 
  let overallScore: number | undefined = undefined;
  const scoresForAggregation: { normalizedScore: number; weight: number }[] = [];

  allResults.forEach(r => {
    if (r.error) return; // Skip results with errors

    const criterion = input.criteria.find(c => c.name === r.criterionName);
    if (!criterion) {
      console.warn(`[EvaluationRunner] Criterion '${r.criterionName}' not found in input.criteria during aggregation. Skipping score.`);
      return;
    }

    const normalizedScore = normalizeEvaluationScore(r.score, criterion.scale);
    
    if (normalizedScore !== null) {
      scoresForAggregation.push({
        normalizedScore: normalizedScore,
        weight: criterion.weight ?? 1,
      });
    } else {
      console.warn(`[EvaluationRunner] Score for criterion '${r.criterionName}' (value: '${r.score}', scale: '${criterion.scale}') could not be normalized for aggregation.`);
    }
  });

  if (scoresForAggregation.length > 0) {
    const totalWeightedScore = scoresForAggregation.reduce((sum, item) => sum + (item.normalizedScore * item.weight), 0);
    const totalWeight = scoresForAggregation.reduce((sum, item) => sum + item.weight, 0);
    // Avoid division by zero if all weights are zero (though unlikely if items exist)
    overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0; 
  }
  // --- End Aggregation --- 

  const endTime = Date.now();
  const duration = endTime - startTime;

  const finalMetadata = { ...runMetadata, errors, durationMs: duration };

  const aggregatedResult: AggregatedEvaluationResult = {
    overallScore,
    results: allResults,
    timestamp: endTime,
    agentId: input.agentId,
    sessionId: input.sessionId,
    inputSnapshot: input, 
    evaluationConfigSnapshot: { 
      evaluatorTypes: instantiatedEvaluatorTypes,
      criteriaNames: input.criteria.map(c => c.name),
      // Updated to reflect that storage is now externally managed or not present
      storageProviderType: storageProvider ? 'external' : 'none',
      metadataKeys: Object.keys(runMetadata),
    },
    metadata: finalMetadata,
  };

  // Use the passed-in storageProvider directly
  if (storageProvider) {
    try {
      console.log(`[EvaluationRunner] Saving aggregated result via provided storage provider...`);
      await storageProvider.saveResult(aggregatedResult);
      console.log(`[EvaluationRunner] Aggregated result saved via provided storage provider.`);
    } catch (error) {
      console.error('[EvaluationRunner] Failed to save evaluation result via provided storage provider:', error);
    }
  } else {
    console.log('[EvaluationRunner] No storage provider configured. Results not saved by runner.');
  }

  console.log(`[EvaluationRunner] Evaluation run completed in ${duration} ms.`);
  return aggregatedResult;
} 