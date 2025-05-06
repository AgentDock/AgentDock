import type {
  EvaluationInput,
  AggregatedEvaluationResult,
  EvaluationCriteria,
  Evaluator,
  EvaluationStorageProvider,
  EvaluationResult
} from '../types';
import { JsonFileStorageProvider } from '../storage/json_file_storage';

/**
 * Configuration for a specific evaluation run.
 */
export interface EvaluationRunConfig {
  /** An array of evaluator instances to run. */
  evaluators: Evaluator[];
  /** The set of criteria to evaluate against in this run. */
  // criteria: EvaluationCriteria[]; // Removed: Criteria are now part of EvaluationInput
  /** Optional storage provider instance. Defaults to JsonFileStorageProvider. */
  storageProvider?: EvaluationStorageProvider;
  /** Optional run-level metadata to include in the aggregated result. */
  metadata?: Record<string, any>;
  /** Optional settings for specific evaluators, keyed by evaluator type. */
  evaluatorSettings?: Record<string, any>;
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
    evaluators,
    // criteria, // Criteria are primarily passed *within* the input now
    storageProvider = new JsonFileStorageProvider('./evaluation_results.log'),
    metadata: runMetadata = {},
    // evaluatorSettings = {}
  } = config;

  const allResults: EvaluationResult[] = [];
  const errors: { evaluatorType: string, error: string }[] = [];

  // Execute evaluators in parallel (or sequentially if needed? Parallel is generally better for IO)
  // Filter criteria within the input for each evaluator? Or does evaluator handle it?
  // Current design: Evaluator receives all criteria from input and decides which to handle.
  const evaluationPromises = evaluators.map(async (evaluator) => {
    try {
      console.log(`[EvaluationRunner] Running evaluator: ${evaluator.type}`);
      // Pass the full input and the criteria *from the input*
      const evaluatorResults = await evaluator.evaluate(input, input.criteria);
      console.log(`[EvaluationRunner] Evaluator ${evaluator.type} completed with ${evaluatorResults.length} results.`);
      return evaluatorResults;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[EvaluationRunner] Evaluator ${evaluator.type} failed:`, errorMessage);
      errors.push({ evaluatorType: evaluator.type, error: errorMessage });
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
      evaluatorTypes: evaluators.map(e => e.type),
      criteriaNames: input.criteria.map(c => c.name),
      // Avoid snapshotting provider instance
      storageProviderType: storageProvider?.constructor?.name || 'default',
      metadataKeys: Object.keys(runMetadata),
      // evaluatorSettings, // Maybe too verbose/sensitive?
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