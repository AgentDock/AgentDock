# AgentDock Evaluation Framework: Measuring What Matters

The capability to build AI agents is rapidly becoming commoditized. The real differentiator lies in the ability to systematically and reliably measure agent quality. Without robust evaluation, "improvement" is guesswork, and "reliability" is a marketing slogan. Experience in deploying these systems has consistently shown that what isn't measured, isn't managed, and certainly isn't improved in a way that stands up to real-world demands.

AgentDock Core now includes a foundational, extensible **Evaluation Framework** designed to address this critical need. This isn't about chasing every possible academic metric; it's about providing a practical, adaptable toolkit for developers to define what quality means for _their_ agents and to measure it consistently.

## Core Philosophy: Practicality and Extensibility

The framework is built on two core tenets:

1.  **Practicality:** The framework provides a suite of common-sense evaluators out-of-the-box--from simple rule-based checks and lexical analysis to sophisticated LLM-as-judge capabilities. These are tools designed for immediate utility in typical development and CI/CD workflows. The focus is on actionable insights, not just scores.
2.  **Extensibility:** No framework can anticipate every evaluation need. The AgentDock Evaluation Framework is architected around a clear `Evaluator` interface. This allows developers to seamlessly integrate custom evaluation logic, whether it's proprietary business rules, specialized NLP models, or wrappers around third-party evaluation services, without needing to modify the core framework.

This isn't just about running tests; it's about building a continuous feedback loop that drives genuine improvement in agent performance, safety, and reliability.

## Key Components & Concepts

Understanding the framework starts with a few core components:

```mermaid
graph TD
    A[EvaluationInput] --> ER[EvaluationRunner]
    ARC[EvaluationRunConfig] --> ER

    subgraph EvaluationInput Components
        direction LR
        A_crit[EvaluationCriteria]
        A_resp[Agent Response]
        A_prom[Prompt]
        A_hist[Message History]
        A_cont[Context]
        A_conf[Agent Config]
        A_crit --> A
        A_resp --> A
        A_prom --> A
        A_hist --> A
        A_cont --> A
        A_conf --> A
    end

    subgraph EvaluationRunConfig Components
        direction LR
        ARC_eval_configs[Evaluator Configurations]
        ARC_storage["storageProvider (optional)"]
        ARC_eval_configs --> ARC
        ARC_storage --> ARC
    end

    ER -- uses --> E[Evaluator Interface]
    E -- processes w/ --> A_crit
    E -- produces --> RES[EvaluationResult]

    ER -- aggregates --> AGG[AggregatedEvaluationResult]
    RES --> AGG

    style ER fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px
    style AGG fill:#9f9,stroke:#333,stroke-width:2px
    style A fill:#lightgrey,stroke:#333
    style ARC fill:#lightgrey,stroke:#333
```

- **`EvaluationInput`**: This is the data packet for an evaluation. It's a rich structure containing not just the agent's `response`, but also the `prompt`, `groundTruth` (if available), `messageHistory`, `context`, `agentConfig`, and the `criteria` to be assessed. Providing comprehensive input enables more nuanced and context-aware evaluations.
- **`EvaluationCriteria`**: Defines _what_ you're measuring. Each criterion has a `name`, `description`, and an `EvaluationScale` (e.g., `binary`, `likert5`, `numeric`, `pass/fail`). This allows for both quantitative and qualitative assessments.
- **`Evaluator` Interface**: The heart of the system's extensibility. Any class implementing this interface can be plugged into the framework. It defines a `type` identifier and an `evaluate` method that takes an `EvaluationInput` and `EvaluationCriteria[]`, returning `EvaluationResult[]`.
- **`EvaluationResult`**: The output from a single evaluator for a single criterion. It includes the `criterionName`, the `score` (which can be a number, boolean, or string), optional `reasoning`, and the `evaluatorType`.
- **`EvaluationRunConfig`**: Configures an evaluation run. It specifies the `evaluatorConfigs` (which evaluators to use and their specific settings), includes the optional `storageProvider (optional)`, and can include run-level `metadata`.
- **`EvaluationRunner`**: The orchestrator. The `runEvaluation(input: EvaluationInput, config: EvaluationRunConfig)` function takes the input and configuration, instantiates the necessary evaluators, executes them, and aggregates their findings.
- **`AggregatedEvaluationResult`**: The final output of `runEvaluation`. It contains an optional `overallScore` (if applicable through normalization and weighting of criteria), a list of all individual `EvaluationResult` objects, a snapshot of the input and configuration, and metadata for the run.

## Getting Started: The `runEvaluation` Function

The primary entry point is the `runEvaluation` function. Developers provide the `EvaluationInput` (what to test and how) and the `EvaluationRunConfig` (which evaluators to use). The function returns a promise resolving to the `AggregatedEvaluationResult`.

```typescript
// Conceptual Example:
import { runEvaluation, type EvaluationInput, type EvaluationRunConfig } from 'agentdock-core';
// ... import specific evaluator configs ...

async function performMyEvaluation() {
  const input: EvaluationInput = {
    /* ... your agent's output, criteria, etc. ... */
  };
  const config: EvaluationRunConfig = {
    evaluatorConfigs: [
      {
        type: 'RuleBased',
        rules: [
          /* ... your rules ... */
        ],
      },
      {
        type: 'LLMJudge',
        config: {
          /* ... your LLM judge setup ... */
        },
      },
      // ... other evaluator configurations
    ],
    // For server-side scripts wanting to persist results, a storage mechanism can be provided:
    // storageProvider: new JsonFileStorageProvider({ filePath: './my_eval_results.log' })
  };

  const aggregatedResult = await runEvaluation(input, config);
  console.log(JSON.stringify(aggregatedResult, null, 2));
  // Further process or store aggregatedResult as needed
}
```

And here's a visual representation of that flow:

```mermaid
sequenceDiagram
    participant D as Developer/System
    participant RFE as runEvaluation()
    participant ER as EvaluationRunner (Internal)
    participant EV as Evaluator(s)
    participant SP as StorageProvider (Optional)

    D->>RFE: Calls with EvaluationInput & EvaluationRunConfig
    RFE->>ER: Processes input & config
    ER->>EV: Instantiates & calls evaluate()
    EV-->>ER: Returns EvaluationResult(s)
    alt storageProvider is provided
        ER->>SP: saveResult(AggregatedEvaluationResult)
        SP-->>ER: Confirmation
    end
    ER-->>RFE: Provides AggregatedEvaluationResult
    RFE-->>D: Returns AggregatedEvaluationResult
```

## Result Persistence

The `EvaluationRunner` returns the `AggregatedEvaluationResult` in memory. For server-side scenarios (like CI runs or dedicated evaluation scripts), persisting these results is often necessary.

The `EvaluationRunConfig` accepts an optional `storageProvider` parameter. Server-side scripts can instantiate a logger, such as the `JsonFileStorageProvider` (imported directly via its file path: `agentdock-core/src/evaluation/storage/json_file_storage.ts`), and pass it to the runner. This provider will append each `AggregatedEvaluationResult` as a JSON line to the specified file.

```typescript
// Example of using JsonFileStorageProvider in a server-side script:
import { JsonFileStorageProvider } from '../agentdock-core/src/evaluation/storage/json_file_storage'; // Direct path import
// ...
const myFileLogger = new JsonFileStorageProvider({ filePath: './evaluation_run_output.jsonl' });
const config: EvaluationRunConfig = {
  // ... other configs
  storageProvider: myFileLogger,
};
// ...
```

While this direct file logging is practical for many use cases, the long-term vision is for evaluation result persistence to integrate more deeply with AgentDock Core's broader [Storage Abstraction Layer (SAL)](../storage/README.md). This would allow evaluation results to be seamlessly routed to various configurable backends (e.g., databases, cloud storage) managed by the SAL, offering greater flexibility and consistency with how other AgentDock data is handled. For now, direct instantiation of specific loggers like `JsonFileStorageProvider` provides a robust server-side solution.

## Available Evaluators

The framework ships with a versatile set of built-in evaluators:

- [**Rule-Based Evaluator**](./evaluators/rule-based.md): For fast, deterministic checks based on predefined rules (length, regex, keywords, JSON parsing).
- [**LLM-as-Judge Evaluator**](./evaluators/llm-judge.md): Leverages a language model to provide nuanced, qualitative assessments.
- [**NLP Accuracy Evaluator**](./evaluators/nlp-accuracy.md): Measures semantic similarity between a response and ground truth using embeddings.
- [**Tool Usage Evaluator**](./evaluators/tool-usage.md): Assesses the correctness of an agent's tool invocations and argument handling.
- **Lexical Evaluators**: A suite of fast, non-LLM evaluators for common textual checks:
  - [**Lexical Similarity Evaluator**](./evaluators/lexical-similarity.md): Compares string similarity using various algorithms.
  - [**Keyword Coverage Evaluator**](./evaluators/keyword-coverage.md): Checks for the presence and coverage of specified keywords.
  - [**Sentiment Evaluator**](./evaluators/sentiment.md): Analyzes the sentiment (positive, negative, neutral) of the text.
  - [**Toxicity Evaluator**](./evaluators/toxicity.md): Scans text for predefined toxic terms.

## Next Steps

Dive deeper into the specifics of each evaluator, learn how to create custom evaluators, and explore the example script (`scripts/examples/run_evaluation_example.ts`) in the repository to see the framework in action.

This framework is a living system. The expectation is that it will evolve as new patterns and requirements are identified from real-world agent deployments. The current foundation, however, provides the necessary tools to move beyond subjective assessments and start building a culture of measurable quality.

## Example Evaluation Outputs

This section provides examples of the `AggregatedEvaluationResult` objects that the `EvaluationRunner` produces. These are typically written to a log file (e.g., `evaluation_results.log` if using the `JsonFileStorageProvider`) or can be processed directly if no storage provider is used.

### Comprehensive Evaluation Run

The following is an example output from a run that includes multiple types of evaluators (RuleBased, LLMJudge, NLPAccuracy, ToolUsage, and the Lexical Suite). This demonstrates the typical structure of a complete evaluation result.

```json
{
  "overallScore": 0.9578790001807427,
  "results": [
    {
      "criterionName": "IsConcise",
      "score": true,
      "reasoning": "Rule length on field 'response' passed.",
      "evaluatorType": "RuleBased"
    },
    {
      "criterionName": "ContainsAgentDock",
      "score": true,
      "reasoning": "Rule includes on field 'response' passed.",
      "evaluatorType": "RuleBased"
    },
    {
      "criterionName": "IsHelpful",
      "score": 5,
      "reasoning": "The response accurately answers the query by providing the requested information about the weather in London. It is clear, concise, and directly addresses the user's request.",
      "evaluatorType": "LLMJudge",
      "metadata": {
        "rawLlmScore": 5
      }
    },
    {
      "criterionName": "SemanticMatchToGreeting",
      "score": 0.8556048791777057,
      "reasoning": "Cosine similarity: 0.8556.",
      "evaluatorType": "NLPAccuracy"
    },
    {
      "criterionName": "UsedSearchToolCorrectly",
      "score": true,
      "reasoning": "Tool 'search_web' was called 1 time(s). Argument check passed for the first call.",
      "evaluatorType": "ToolUsage"
    },
    {
      "criterionName": "UsedRequiredFinalizeTool",
      "score": true,
      "reasoning": "Tool 'finalize_task' was called 1 time(s). Argument check passed for the first call.",
      "evaluatorType": "ToolUsage"
    },
    {
      "criterionName": "LexicalResponseMatch",
      "score": 0.8979591836734694,
      "reasoning": "Comparing 'response' with 'groundTruth' using sorensen-dice. Case-insensitive comparison. Whitespace normalized. Sørensen-Dice similarity: 0.8980. Processed source: \"i am an agentdock assistant. i found the weather for you. the weather in london is 15c and cloudy. i...\", Processed reference: \"as an agentdock helper, i can assist you with various activities. the weather in london is currently...\".",
      "evaluatorType": "LexicalSimilarity"
    },
    {
      "criterionName": "ResponseKeywordCoverage",
      "score": 1,
      "reasoning": "Found 4 out of 4 keywords. Coverage: 100.00%. Found: [weather, london, assistant, task]. Missed: []. Source text (processed): \"i am an agentdock assistant. i found the weather for you. the weather in london is 15c and cloudy. i have finalized the task.\".",
      "evaluatorType": "KeywordCoverage"
    },
    {
      "criterionName": "ResponseSentiment",
      "score": 0.5,
      "reasoning": "Sentiment analysis of 'response'. Raw score: 0, Comparative: 0.0000. Output type: comparativeNormalized -> 0.5000.",
      "evaluatorType": "Sentiment",
      "metadata": {
        "rawScore": 0,
        "comparativeScore": 0,
        "positiveWords": [],
        "negativeWords": []
      }
    },
    {
      "criterionName": "IsNotToxic",
      "score": true,
      "reasoning": "Toxicity check for field 'response'. No configured toxic terms found. Configured terms: [hate, stupid, terrible, awful, idiot]. Case sensitive: false, Match whole word: true.",
      "evaluatorType": "Toxicity",
      "metadata": {
        "foundToxicTerms": []
      }
    }
  ],
  "timestamp": 1746674996953,
  "agentId": "example-agent-tsx-002",
  "sessionId": "example-session-tsx-1746674993007",
  "inputSnapshot": {
    "prompt": "Hello, what can you do for me? And find weather in London.",
    "response": "I am an AgentDock assistant. I found the weather for you. The weather in London is 15C and Cloudy. I have finalized the task.",
    "groundTruth": "As an AgentDock helper, I can assist you with various activities. The weather in London is currently 15C and cloudy.",
    "criteria": "[... criteria definitions truncated for README example ...]",
    "agentId": "example-agent-tsx-002",
    "sessionId": "example-session-tsx-1746674993007",
    "messageHistory": "[... message history truncated for README example ...]"
  },
  "evaluationConfigSnapshot": {
    "evaluatorTypes": [
      "RuleBased",
      "LLMJudge:IsHelpful",
      "NLPAccuracy:SemanticMatchToGreeting",
      "ToolUsage",
      "LexicalSimilarity:LexicalResponseMatch",
      "KeywordCoverage:ResponseKeywordCoverage",
      "Sentiment:ResponseSentiment",
      "Toxicity:IsNotToxic"
    ],
    "criteriaNames": [
      "IsConcise",
      "IsHelpful",
      "ContainsAgentDock",
      "SemanticMatchToGreeting",
      "UsedSearchToolCorrectly",
      "UsedRequiredFinalizeTool",
      "LexicalResponseMatch",
      "ResponseKeywordCoverage",
      "ResponseSentiment",
      "IsNotToxic"
    ],
    "storageProviderType": "external",
    "metadataKeys": ["testSuite"]
  },
  "metadata": {
    "testSuite": "example_tsx_explicit_dotenv_local_script_with_nlp",
    "errors": [],
    "durationMs": 3946
  }
}
```

### Negative Sentiment Test

This example shows the output when specifically testing the `SentimentEvaluator` with a configuration designed to categorize a clearly negative response. Note that `overallScore` might be absent if only non-numeric scores (like string categories) are produced and no aggregation is performed or possible.

```json
{
  "results": [
    {
      "criterionName": "NegativeResponseSentimentCategory",
      "score": "negative",
      "reasoning": "Sentiment analysis of 'response'. Raw score: -11, Comparative: -0.8462. Output type: category -> negative. (PosThreshold: 0.2, NegThreshold: -0.2).",
      "evaluatorType": "Sentiment",
      "metadata": {
        "rawScore": -11,
        "comparativeScore": -0.8461538461538461,
        "positiveWords": [],
        "negativeWords": ["unhappy", "awful", "terrible", "hate"]
      }
    }
  ],
  "timestamp": 1746674996970,
  "agentId": "example-agent-tsx-003",
  "sessionId": "example-session-tsx-neg-1746674993007",
  "inputSnapshot": {
    "prompt": "Hello, what can you do for me? And find weather in London.",
    "response": "I hate this. This is terrible and awful and I am very unhappy.",
    "groundTruth": "As an AgentDock helper, I can assist you with various activities. The weather in London is currently 15C and cloudy.",
    "criteria": "[... criteria definitions truncated for README example ...]",
    "agentId": "example-agent-tsx-003",
    "sessionId": "example-session-tsx-neg-1746674993007",
    "messageHistory": "[... message history truncated for README example ...]"
  },
  "evaluationConfigSnapshot": {
    "evaluatorTypes": ["Sentiment:NegativeResponseSentimentCategory"],
    "criteriaNames": "[... criteria names truncated for README example ...]",
    "storageProviderType": "external",
    "metadataKeys": ["testSuite"]
  },
  "metadata": {
    "testSuite": "negative_sentiment_category_test",
    "errors": [],
    "durationMs": 3
  }
}
```

### Toxic Response Test

This example shows the output when specifically testing the `ToxicityEvaluator`. The response contains terms from the blocklist, resulting in a `false` score for the `IsNotToxic` criterion and an `overallScore` of 0 (as this was the only criterion weighted for this run in the example script).

```json
{
  "overallScore": 0,
  "results": [
    {
      "criterionName": "IsNotToxic",
      "score": false,
      "reasoning": "Toxicity check for field 'response'. Found toxic terms: [hate, stupid, terrible, idiot]. Configured terms: [hate, stupid, terrible, awful, idiot]. Case sensitive: false, Match whole word: true.",
      "evaluatorType": "Toxicity",
      "metadata": {
        "foundToxicTerms": ["hate", "stupid", "terrible", "idiot"]
      }
    }
  ],
  "timestamp": 1746674996975,
  "agentId": "example-agent-tsx-004",
  "sessionId": "example-session-tsx-toxic-1746674993007",
  "inputSnapshot": {
    "prompt": "Hello, what can you do for me? And find weather in London.",
    "response": "You are a stupid idiot and I hate this terrible service.",
    "groundTruth": "As an AgentDock helper, I can assist you with various activities. The weather in London is currently 15C and cloudy.",
    "criteria": "[... criteria definitions truncated for README example ...]",
    "agentId": "example-agent-tsx-004",
    "sessionId": "example-session-tsx-toxic-1746674993007",
    "messageHistory": "[... message history truncated for README example ...]"
  },
  "evaluationConfigSnapshot": {
    "evaluatorTypes": ["Toxicity:IsNotToxic"],
    "criteriaNames": "[... criteria names truncated for README example ...]",
    "storageProviderType": "external",
    "metadataKeys": ["testSuite"]
  },
  "metadata": {
    "testSuite": "toxic_response_test",
    "errors": [],
    "durationMs": 0
  }
}
```
