import type {
  EvaluationInput,
  AggregatedEvaluationResult,
  EvaluationCriteria,
  Evaluator,
  EvaluationStorageProvider,
  EvaluationResult
} from '../types';
import { JsonFileStorageProvider } from '../storage/json_file_storage';
// Import concrete evaluator types and their configs
import { RuleBasedEvaluator, type EvaluationRule } from '../evaluators/rule-based';
import { LLMJudgeEvaluator, type LLMJudgeConfig } from '../evaluators/llm';

/** Configuration for a rule-based evaluator within the run */
interface RuleBasedEvaluatorConfig {
  type: 'RuleBased';
  rules: EvaluationRule[];
}

/** Configuration for an LLM judge evaluator within the run */
interface LLMJudgeEvaluatorConfig {
  type: 'LLMJudge';
  config: LLMJudgeConfig; // The actual config needed by the LLMJudgeEvaluator constructor
}

// Union type for possible evaluator configurations
type EvaluatorConfig = RuleBasedEvaluatorConfig | LLMJudgeEvaluatorConfig;

/**
 * Configuration for a specific evaluation run.
 */
export interface EvaluationRunConfig {
  /** An array of evaluator configurations to instantiate and run. */
  evaluatorConfigs: EvaluatorConfig[];
  /** Optional storage provider instance. Defaults to JsonFileStorageProvider. */
  storageProvider?: EvaluationStorageProvider;
  /** Optional run-level metadata to include in the aggregated result. */
  metadata?: Record<string, any>;
  /** Optional settings for specific evaluators, keyed by evaluator type (if needed beyond individual configs). */
  // evaluatorSettings?: Record<string, any>; // Maybe remove if configs are sufficient
  // TODO: Add other runner-specific settings like aggregation strategy, error handling policy?
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

  const { 
    evaluatorConfigs, // Use configs instead of instances
    storageProvider = new JsonFileStorageProvider('./evaluation_results.log'),
    metadata: runMetadata = {},
  } = config;

  const allResults: EvaluationResult[] = [];
  const errors: { evaluatorType: string, error: string }[] = [];
  const instantiatedEvaluatorTypes: string[] = []; // For snapshot

  const evaluationPromises = evaluatorConfigs.map(async (evalConfig) => {
    let evaluator: Evaluator;
    let evaluatorType: string = evalConfig.type; // Get type from config
    try {
      // Instantiate evaluator based on config type
      if (evalConfig.type === 'RuleBased') {
        evaluator = new RuleBasedEvaluator(evalConfig.rules);
      } else if (evalConfig.type === 'LLMJudge') {
        // TODO: We need to handle the LLMAdapter instantiation here or assume it's pre-configured in evalConfig.config.llm
        // For now, assume config.llm is a valid LLMAdapter instance provided in the config.
        if (!evalConfig.config.llm) {
            throw new Error('LLMJudgeConfig requires an instantiated LLMAdapter.');
        }
        evaluator = new LLMJudgeEvaluator(evalConfig.config);
        evaluatorType = `${evalConfig.type}:${evalConfig.config.criterionName}`; // More specific type for logging/snapshot
      } else {
        // Handle unknown evaluator type
        throw new Error(`Unknown evaluator type specified in config: ${(evalConfig as any).type}`);
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
  // TODO: Implement more sophisticated aggregation (e.g., weighted average)
  let overallScore: number | undefined = undefined;
  const numericScores = allResults
    .map(r => {
      const criterion = input.criteria.find(c => c.name === r.criterionName);
      const weight = criterion?.weight ?? 1;
      const score = typeof r.score === 'number' ? r.score : undefined; 
      return { score, weight };
    })
    .filter(item => item.score !== undefined);

  if (numericScores.length > 0) {
    const totalWeightedScore = numericScores.reduce((sum, item) => sum + (item.score! * item.weight), 0);
    const totalWeight = numericScores.reduce((sum, item) => sum + item.weight, 0);
    overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : undefined;
  }
  // --- End Aggregation --- 

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Include errors in metadata? Or a dedicated field?
  const finalMetadata = { ...runMetadata, errors, durationMs: duration };

  const aggregatedResult: AggregatedEvaluationResult = {
    overallScore,
    results: allResults,
    timestamp: endTime,
    agentId: input.agentId,
    sessionId: input.sessionId,
    inputSnapshot: input, // Consider deep cloning input?
    evaluationConfigSnapshot: { // Snapshot relevant parts of config
      // evaluatorTypes: evaluators.map(e => e.type), // Use instantiated types
      evaluatorTypes: instantiatedEvaluatorTypes,
      criteriaNames: input.criteria.map(c => c.name),
      storageProviderType: storageProvider?.constructor?.name || 'default',
      metadataKeys: Object.keys(runMetadata),
    },
    metadata: finalMetadata,
  };

  try {
    console.log(`[EvaluationRunner] Saving aggregated result...`);
    await storageProvider.saveResult(aggregatedResult);
    console.log(`[EvaluationRunner] Aggregated result saved.`);
  } catch (error) {
    console.error('[EvaluationRunner] Failed to save evaluation result:', error);
    // Decide how to handle storage errors (e.g., log, throw?)
    // For now, we still return the result even if saving failed.
  }

  console.log(`[EvaluationRunner] Evaluation run completed in ${duration} ms.`);
  return aggregatedResult;
} 