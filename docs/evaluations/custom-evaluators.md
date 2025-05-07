# Creating Custom Evaluators

The AgentDock Evaluation Framework is designed for extensibility. While the built-in evaluators cover many common use cases, you will inevitably encounter scenarios requiring bespoke evaluation logic specific to your agent's tasks, data, or business rules. My philosophy has always been that a framework's true power lies in its adaptability.

The core of this extensibility is the `Evaluator` interface. By implementing this interface, you can seamlessly integrate your custom evaluation logic into the `EvaluationRunner` and leverage the broader framework features.

## The `Evaluator` Interface

To create a custom evaluator, you need to define a class that implements the `Evaluator<ConfigType, ResultType>` interface. This interface is defined as follows (conceptually):

```typescript
// Conceptual representation (refer to actual types in agentdock-core)
interface Evaluator<ConfigType = any, InputType = any, ResultType = any> {
  /** 
   * A unique string identifier for this evaluator type. 
   * This is used in EvaluationRunConfig to specify which evaluator to use.
   */
  type: string;

  /**
   * The core evaluation logic.
   * @param input The full EvaluationInput for the current run.
   * @param criteria The specific EvaluationCriteria this evaluator should assess.
   * @param config The specific configuration for this instance of the evaluator, taken from EvaluationRunConfig.
   * @returns A Promise resolving to an array of EvaluationResult objects.
   */
  evaluate(
    input: EvaluationInput<InputType>, 
    criteria: EvaluationCriteria[], 
    config: ConfigType
  ): Promise<EvaluationResult<ResultType>[]>;
}
```

Key aspects:

*   **`type` (string):** This is a crucial static or instance property. It must be a unique string that identifies your custom evaluator. This `type` string is what users will specify in the `EvaluationRunConfig` to select your evaluator.
*   **`evaluate(input, criteria, config)` (method):** This asynchronous method contains your core evaluation logic. It receives:
    *   `input: EvaluationInput`: The complete input data for the evaluation (agent response, prompt, history, context, etc.).
    *   `criteria: EvaluationCriteria[]`: An array of criteria that this evaluator instance is responsible for assessing. Your evaluator should iterate through these and produce a result for each one it's configured to handle.
    *   `config: ConfigType`: The specific configuration object for this evaluator, as provided in the `evaluatorConfigs` array in `EvaluationRunConfig`. This allows you to parameterize your evaluator.
    *   It must return a `Promise` that resolves to an array of `EvaluationResult` objects.

## Core Workflow of a Custom Evaluator

The following diagram illustrates the general workflow when a custom evaluator is invoked by the `EvaluationRunner`:

```mermaid
graph TD
    ERC[EvaluationRunConfig] -- "Specifies 'CustomType' & Config" --> ER[EvaluationRunner]
    
    subgraph CustomLogic
        CE[YourCustomEvaluator] -- "Implements" --> EIface[Evaluator Interface]
        EIface -.-> EvalMethod["evaluate(input, criteria, config)"]
        CE -- "Uses" --> CEC["Custom Evaluator Config (from ERC)"]
        CE -- "Processes" --> EIn["EvaluationInput"]
        CE -- "Produces" --> EVR[EvaluationResult(s)]
    end

    ER -- "Instantiates/Uses" --> CE
    EVR --> ER

    style ER fill:#f9f,stroke:#333,stroke-width:2px
    style CE fill:#ccf,stroke:#333,stroke-width:2px
    style EIface fill:#e6e6fa,stroke:#333
    style EVR fill:#9f9,stroke:#333,stroke-width:2px
```

## Example: A Simple Custom Length Checker

Let's imagine a custom evaluator that checks if a response length is *exactly* a specific value, different from the min/max range check of the built-in `RuleBasedEvaluator`.

```typescript
// my-custom-evaluators.ts
import type { 
  Evaluator, 
  EvaluationInput, 
  EvaluationCriteria, 
  EvaluationResult 
} from 'agentdock-core'; // Adjust path as necessary

// Configuration type for our custom evaluator
interface ExactLengthConfig {
  expectedLength: number;
  sourceField?: string; // e.g., 'response', 'context.someField'
}

class ExactLengthEvaluator implements Evaluator<ExactLengthConfig> {
  public readonly type = 'ExactLengthCheck'; // Unique type identifier

  async evaluate(
    input: EvaluationInput,
    criteria: EvaluationCriteria[],
    config: ExactLengthConfig
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    const sourceField = config.sourceField || 'response';
    let textToEvaluate: string | undefined;

    if (sourceField === 'response') {
      textToEvaluate = typeof input.response === 'string' ? input.response : undefined;
    } else if (sourceField.startsWith('context.')) {
      const contextKey = sourceField.substring('context.'.length);
      // Basic context navigation; real-world might need more robust path resolution
      textToEvaluate = input.context && typeof input.context[contextKey] === 'string' 
        ? input.context[contextKey] 
        : undefined;
    } 
    // Add more sourceField handling as needed (e.g., prompt, groundTruth)

    for (const criterion of criteria) {
      if (textToEvaluate === undefined) {
        results.push({
          criterionName: criterion.name,
          score: false,
          reasoning: `Source field '${sourceField}' not found or not a string.`,
          evaluatorType: this.type,
        });
        continue;
      }

      const actualLength = textToEvaluate.length;
      const passed = actualLength === config.expectedLength;

      results.push({
        criterionName: criterion.name,
        score: passed,
        reasoning: passed 
          ? `Response length is exactly ${config.expectedLength}.` 
          : `Expected length ${config.expectedLength}, got ${actualLength}.`,
        evaluatorType: this.type,
      });
    }
    return results;
  }
}

// To make it available, you might export it or register it with a central registry if your app has one.
export { ExactLengthEvaluator };
```

## Using Your Custom Evaluator

Once defined, you would use your custom evaluator in an `EvaluationRunConfig` by providing its `type` and any necessary configuration:

```typescript
// in your evaluation script
// import { ExactLengthEvaluator } from './my-custom-evaluators'; // Assuming local file
// import { EvaluationRunner, type EvaluationRunConfig ... } from 'agentdock-core';

// If your custom evaluator isn't automatically discoverable by EvaluationRunner via its type,
// you might need to pass an instance directly if the runner supports it, 
// or ensure your bundler includes it if type-based instantiation is used.
// The current EvaluationRunner instantiates evaluators based on their 'type' string matching
// a known set of built-in evaluators. For true custom external evaluators, the runner
// would need a mechanism to register or receive instantiated custom evaluators.
// For now, let's assume it can be configured if EvaluationRunner is adapted or if it's used within the same project scope.

const runConfig: EvaluationRunConfig = {
  evaluatorConfigs: [
    // ... other built-in evaluator configs
    {
      type: 'ExactLengthCheck', // The unique type string of your custom evaluator
      // criteriaNames: ['MustBeSpecificLength'], // Link to specific criteria names
      config: { // The ExactLengthConfig for this instance
        expectedLength: 50,
        sourceField: 'response'
      }
    }
  ],
  // ... other run config properties
};

// const results = await runEvaluation(myInput, runConfig);
```

Building custom evaluators empowers you to tailor the AgentDock Evaluation Framework precisely to your needs, ensuring that your agent's quality is measured against the metrics that matter most for your application. 