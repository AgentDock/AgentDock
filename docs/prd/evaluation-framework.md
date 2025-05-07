# PRD: AgentDock Evaluation Framework - Building for Measurable Quality

## 1. The Problem: We Can't Reliably Measure Agent Quality

AgentDock currently lacks a systematic way to evaluate agent performance. We can build agents, but actually *measuring* their quality--accuracy, relevance, safety, adherence to instructions--is inconsistent and subjective. My experience shows this isn't theoretical; it's a practical bottleneck hindering our ability to:

*   **Identify Regressions:** We can't reliably detect if a change degraded performance without objective metrics. We're flying blind.
*   **Benchmark Effectively:** Comparing models or prompts relies on guesswork, not data. This slows down meaningful improvement.
*   **Improve Systematically:** Real progress demands a data-driven feedback loop. Subjectivity doesn't scale and wastes engineering effort.
*   **Ensure Production Readiness:** Shipping agents without clear quality metrics is unacceptable for mission-critical systems. "Looks good" isn't an engineering standard.

This isn't a nice-to-have. Building a robust, integrated evaluation framework is a core requirement for production-grade systems. (Ref: [GitHub Issue #105](https://github.com/AgentDock/AgentDock/issues/105)).

## 2. The Goal: A Foundational, Adaptable Evaluation Core

The objective is clear: Implement a **modular and extensible Evaluation Framework** within `agentdock-core`. We are *not* building every possible metric upfront. The focus is squarely on the **foundational architecture**: interfaces, data structures, execution logic, and integration points. This foundation must allow developers to:

*   Define diverse evaluation criteria specific to their needs.
*   Implement various evaluation methods (`Evaluators`) using a standard contract.
*   Execute evaluations systematically.
*   Aggregate and store results for analysis.
*   **Critically:** Integrate *external* tools or custom logic *without modifying the core framework*. Adaptability is a fundamental design principle, not an afterthought.

The goal is straightforward: Give developers the tools to **systematically measure and improve agent quality** using methods appropriate for their specific constraints. It needs to function both as an in-process library and be suitable for wrapping in a service layer later.

### Intended Use Cases (Beyond Simple Invocation)

This framework must support standard development workflows:

*   **CI/CD Integration:** Run evaluation suites automatically on code/model/prompt changes to catch regressions.
*   **Benchmarking:** Systematically compare agent versions, LLMs, or prompts against standard datasets/criteria.
*   **Observability Integration:** Feed structured evaluation results (scores, metadata, failures) into monitoring/tracing systems (e.g., OpenTelemetry).
*   **Production Monitoring:** Allow periodic evaluation runs on live traffic samples (potentially with different criteria than CI).

## 3. Scope: What We're Building Now (and What We're Not)

Focus is essential. We build the core infrastructure first.

**In Scope (Phase 1 - Largely Completed):**

*   🟢 **Core Architecture:** Defined TypeScript interfaces (`EvaluationInput`, `EvaluationResult`, `EvaluationCriteria`, `AggregatedEvaluationResult`, `Evaluator`, `EvaluationStorageProvider`). These contracts are non-negotiable.
*   🟢 **Evaluation Runner:** Implemented the `EvaluationRunner` orchestrator, including score normalization and weighted aggregation.
*   🟢 **Initial Evaluators:** Provided essential building blocks:
    *   `RuleBasedEvaluator`: For simple, fast, deterministic checks (e.g., keyword presence, length, includes, JSON parsing). Cheap, essential guardrails.
    *   `LLMJudgeEvaluator`: Uses a configurable `CoreLLM` (via Vercel AI SDK) for nuanced quality assessment. Expensive but necessary for subjective measures.
*   🟢 **Criteria Definition:** Mechanism to define/manage `EvaluationCriteria` sets programmatically is in place.
*   🟢 **Result Aggregation:** Implemented weighted averaging with score normalization (0-1 range where applicable) in the runner.
*   🟢 **Storage Interface & Basic Implementation:** Defined `EvaluationStorageProvider` interface. Provided `JsonFileStorageProvider` which appends JSON to a local file.
*   🟢 **Core Integration Points & Example:** `runEvaluation` function is established, and `run_evaluation_example.ts` demonstrates its usage.
*   🟡 **Unit Tests:** Foundational tests for core types and some components exist, but comprehensive coverage for all evaluators, runner logic, and storage provider contracts is still pending.

**Out of Scope (Initial Version - No Change):**

*   **UI/Dashboard:** No frontend visualization. Focus is on the backend engine.
*   **Dedicated Scalable Database Backend:** Default file storage is for utility. Robust storage (PostgreSQL, MLOps DBs) requires separate `EvaluationStorageProvider` implementations later.
*   **Dedicated HTTP Service Layer:** Design must *allow* wrapping in a service, but building that service is out of scope for Phase 1.
*   **Specific 3rd-Party Tool Wrappers:** Won't build wrappers for DeepEval/TruLens initially, but the `Evaluator` interface must make this straightforward.
*   **Advanced NLP/Statistical Metrics:** Complex metrics (BLEU, ROUGE) can be added as custom `Evaluator` implementations later.
*   **Human Feedback Annotation UI:** Framework should *ingest* structured human feedback, but the UI for collection is external.

## 4. Functional Requirements: What It Must Do

*   **FR1: Define Evaluation Criteria:** 🟢 Implemented.
    *   Provide a clear mechanism to define individual evaluation criteria, including `name` (string, unique identifier), `description` (string, explanation for humans), `scale` (`EvaluationScale` enum/union type), and an optional `weight` (number, for weighted aggregation).
    *   Support loading or managing sets of these criteria for specific evaluation runs (currently programmatically).
*   **FR2: Implement Diverse Evaluators:** 🟢 Core interface and initial evaluators implemented.
    *   Define a standard `Evaluator` interface contract: `interface Evaluator { type: string; /* Unique identifier for the evaluator type */ evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]>; }`.
    *   **FR2.1 (Rule-Based):** 🟢 Implemented `RuleBasedEvaluator`. This evaluator is configurable with a set of rules, where each rule is linked to a specific `EvaluationCriteria` (by name) and performs a deterministic check (e.g., regex match, length check, keyword count, JSON parse). It provides fast, low-cost checks suitable for basic validation.
    *   **FR2.2 (LLM-as-Judge):** 🟢 Implemented `LLMJudgeEvaluator`. This evaluator accepts a configured `CoreLLM` instance (compatible with Vercel AI SDK). It uses robust prompt templating and `generateObject` for structured output to assess the `EvaluationInput` against the provided `EvaluationCriteria`. It reliably parses the LLM's response to extract scores and reasoning.
    *   **FR2.3 (NLP-Accuracy - Semantic):** 🟢 Implemented `NLPAccuracyEvaluator`. This evaluator uses embedding models (via Vercel AI SDK or compatible providers) to generate vector embeddings for the agent's response and `groundTruth`. It then calculates cosine similarity, providing a score for semantic alignment. Essential for understanding meaning beyond lexical match.
    *   **FR2.4 (Tool Usage):** 🟢 Implemented `ToolUsageEvaluator`. This rule-based evaluator checks for correct tool invocation, argument validation, and required tool usage based on configured rules. It inspects `messageHistory` or `context` for tool call data.
    *   **FR2.5 (Lexical Suite - Practical & Fast):** 🟢 Implemented a suite of practical, non-LLM lexical evaluators for rapid, cost-effective checks:
        *   `LexicalSimilarityEvaluator`: Measures string similarity (Sorensen-Dice, Jaro-Winkler, Levenshtein) between a source field (e.g., response) and a reference field (e.g., groundTruth). Useful for assessing how close an answer is to an expected textual output.
        *   `KeywordCoverageEvaluator`: Determines the percentage of predefined keywords found in a source text. Critical for ensuring key concepts or entities are addressed. Configurable for case sensitivity, keyword source (config, groundTruth, context), and whitespace normalization.
        *   `SentimentEvaluator`: Analyzes the sentiment of a text (positive, negative, neutral) using an AFINN-based library. Provides options for normalized comparative scores, raw scores, or categorical output. Essential for gauging the tone of a response.
        *   `ToxicityEvaluator`: Scans text for a predefined list of toxic terms. Returns a binary score (toxic/not-toxic). A fundamental check for safety and appropriateness. Configurable for case sensitivity and whole-word matching.
    *   **FR2.6 (Extensibility):** 🟢 The framework makes it straightforward for developers to create and integrate their own custom `Evaluator` classes by simply implementing the `Evaluator` interface. This is the primary hook for custom logic.
*   **FR3: Execute Evaluations Systematically:** 🟢 Implemented.
    *   The `EvaluationRunner` component orchestrates the evaluation process.
    *   It accepts an `EvaluationInput` object and an `EvaluationRunConfig` (which includes `evaluatorConfigs` and `criteria` defined in the input).
    *   It iterates through the configured evaluators, invoking their `evaluate` method.
    *   It handles errors at the individual evaluator level, logging errors and continuing where possible.
    *   Execution leverages asynchronous operations (`Promise`).
    *   It collects all successfully generated `EvaluationResult` objects.
*   **FR4: Aggregate Evaluation Results:** 🟢 Implemented.
    *   The `EvaluationRunner` aggregates the collected `EvaluationResult[]` into a single `AggregatedEvaluationResult` object.
    *   It supports weighted average scoring, normalizing scores from different scales (e.g., Likert, boolean, numeric 0-1 or 0-100) to a 0-1 range for consistent aggregation where appropriate.
*   **FR5: Store Evaluation Results Persistently:** 🟢 Implemented.
    *   Defined a clear, serializable schema for `AggregatedEvaluationResult`, capturing essential information.
    *   Defined `EvaluationStorageProvider` interface: `interface EvaluationStorageProvider { saveResult(result: AggregatedEvaluationResult): Promise<void>; }`.
    *   Provided `JsonFileStorageProvider`, which appends the serialized `AggregatedEvaluationResult` to a file.
*   **FR6: Integrate with Core AgentDock:** 🟢 Implemented.
    *   The primary invocation API `runEvaluation(input: EvaluationInput, config: EvaluationRunConfig): Promise<AggregatedEvaluationResult>` is established.
    *   The `EvaluationRunConfig` expects `evaluatorConfigs` (an array of `RuleBasedEvaluatorConfig | LLMJudgeEvaluatorConfig`) which specify the type and specific configuration for each evaluator to be instantiated by the runner.

## 5. Non-Functional Requirements: Ensuring Production Readiness

Beyond just features, the framework must be built for real-world use.

*   **NFR1: Modularity & Extensibility:** This is paramount. The design must heavily rely on interfaces (`Evaluator`, `EvaluationStorageProvider`) to ensure loose coupling. Adding new evaluation methods or storage backends should require *no* changes to the core `EvaluationRunner`. The architecture must inherently support different deployment models (e.g., running evaluations as an in-process library call vs. wrapping the core logic in a separate microservice). This future-proofs the framework.
*   **NFR2: Configurability:** Users must be able to easily configure evaluation runs: selecting which evaluators to use, defining the criteria set, adjusting settings for specific evaluators (e.g., the LLM model for the judge), and specifying the storage provider. Usability depends on good configuration options.
    *   **Configuration Strategy Options:** 
        *   🟢 **Programmatic (Primary for Phase 1):** Configuration objects are passed directly to the `runEvaluation` function via `EvaluationRunConfig`.
        *   **File-Based (Future Consideration):** Design should not preclude loading evaluation configurations (criteria definitions, evaluator selections, specific settings) from dedicated configuration files (e.g., `evaluation.config.ts`, JSON files).
        *   **Agent Definition Integration (Future Consideration):** Potentially allow defining default evaluation configurations as part of an agent's overall definition.
        *   *Initial implementation will focus on programmatic configuration for simplicity and direct control, but the underlying structures should support file-based loading later.*
*   **NFR3: Performance & Cost Awareness:** LLM-based evaluations can be slow and expensive.
    *   The framework must support selective execution of evaluators (e.g., running only fast rule-based checks in some contexts).
    *   IO-bound evaluators (`LLMJudgeEvaluator`, storage providers) must operate asynchronously (`Promise`-based) to avoid blocking the main thread.
    *   Documentation should clearly outline the relative cost and latency implications of different evaluators (e.g., RuleBased vs. LLMJudge). Production decisions often hinge on these factors.
*   **NFR4: Testability:** All core components (runner, evaluators, storage providers, type definitions) must be designed for unit testing. Dependencies should be injectable or easily mockable. Reliable software development demands comprehensive testing.

## 6. High-Level Architecture & Key Data Structures

The implementation will reside primarily within a new top-level directory in the core library.

*   **Primary Directory:** `agentdock-core/src/evaluation/`
*   **Core Types (`evaluation/types.ts`):**
    *   `EvaluationScale = 'binary' | 'likert5' | 'numeric' | 'pass/fail' | string;` 
        // binary: Simple yes/no, true/false. (Normalized to 0 or 1)
        // likert5: Standard 1-5 rating scale. (Normalized to 0-1: (score-1)/4)
        // numeric: Any plain number score. (If 0-1, used as is. If 0-100, normalized to 0-1 by dividing by 100. Other ranges currently not normalized for aggregation unless they are 0 or 1).
        // pass/fail: Clear categorical outcome. (Normalized to 0 or 1)
        // string: For custom scales or categorical results. (Normalized to 0 or 1 if 'true'/'false', 'pass'/'fail', etc., otherwise not typically included in numeric aggregation unless parsable to a number and fitting a numeric/likert scale).
    *   `EvaluationCriteria`: `{ name: string; // Unique identifier for the criterion description: string; // Human-readable explanation scale: EvaluationScale; // The scale used for scoring this criterion weight?: number; // Optional weight for aggregation }`
    *   `EvaluationInput`: `{ // Rich context for the evaluation prompt?: string; // Optional initiating prompt response: string | AgentMessage; // The agent output being evaluated context?: Record<string, any>; // Arbitrary contextual data groundTruth?: string | any; // Optional reference answer/data criteria: EvaluationCriteria[]; // Criteria being evaluated against agentConfig?: Record<string, any>; // Snapshot of agent config at time of response messageHistory?: AgentMessage[]; // Relevant message history timestamp?: number; // Timestamp of the response generation sessionId?: string; // Identifier for the session/conversation agentId?: string; // Identifier for the agent instance metadata?: Record<string, any>; // Other arbitrary metadata (e.g., test runner context if applicable) }`
    *   `EvaluationResult`: `{ // Result for a single criterion from one evaluator criterionName: string; // Links back to EvaluationCriteria.name score: number | boolean | string; // The actual score/judgment reasoning?: string; // Optional explanation from the evaluator (esp. LLM judge) evaluatorType: string; // Identifier for the evaluator producing this result error?: string; // Error message if this specific evaluation failed metadata?: Record<string, any>; // Evaluator-specific metadata }`
    *   `AggregatedEvaluationResult`: `{ // Overall result for an evaluation run overallScore?: number; // Optional aggregated score (e.g., weighted avg) results: EvaluationResult[]; // List of individual results from all evaluators timestamp: number; // Timestamp of the evaluation run completion agentId?: string; // Copied from input sessionId?: string; // Copied from input inputSnapshot: EvaluationInput; // Capture the exact input used evaluationConfigSnapshot?: { evaluatorTypes: string[]; criteriaNames: string[]; storageProviderType: string; metadataKeys: string[]; }; // Snapshot of criteria, evaluators used metadata?: Record<string, any>; // Run-level metadata }`
    *   `Evaluator`: `interface Evaluator { type: string; evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]>; }`
    *   `EvaluationStorageProvider`: `interface EvaluationStorageProvider { saveResult(result: AggregatedEvaluationResult): Promise<void>; }`
*   **Sub-directories & Components:**
    *   `evaluation/criteria/`: Utilities or helpers related to defining/managing criteria sets (if needed beyond simple objects).
    *   `evaluation/evaluators/`: Implementations of the `Evaluator` interface, organized into subdirectories by type (e.g., `rule-based/`, `llm/`, `nlp/`, `tool/`, `lexical/`).
    *   `evaluation/runner/`: Implementation of the `EvaluationRunner` logic (`index.ts`).
    *   `evaluation/storage/`: The `EvaluationStorageProvider` interface definition and concrete implementations (`json_file_storage.ts`, potentially others later).
    *   `evaluation/types.ts`: Location for all core type definitions and interfaces listed above.
    *   `evaluation/index.ts`: Main entry point exporting the public API of the evaluation module (e.g., `runEvaluation` function, core types, interfaces).

## 7. Where We Start: Phased Implementation & Next Steps

**On Test Implementation Timing.** There's a common reflex to demand unit tests for every line of code the moment it's written. We called (NFR4) testability 'mandatory,' and fundamentally, that's not wrong. However, in the context of iterative development--especially when new capabilities are being forged--front-loading comprehensive unit tests for features still in flux often leads to wasted effort. My approach, grounded in experience shipping actual product, is more pragmatic:

1.  **Build the core feature.** Get it to a point where it functions and its core value can be assessed.
2.  **Validate it in a realistic scenario.** This could be through example scripts, integration into a local build--whatever proves it does the intended job effectively. This is about confirming *what* we've built is right.
3.  **Refine based on this practical validation.**
4.  **Once the feature is stable and its design proven, *then* implement the comprehensive unit tests.** These tests then serve their true purpose: to lock in the proven behavior and guard against regressions.

Writing tests for rapidly evolving or unproven code is an exercise in churn. We'll build, we'll validate functionally, and then we'll write the tests that matter for the long term. This ensures our testing effort is targeted and efficient, not just a checkbox exercise.

**Note on Evaluator Test Scenarios:** While initial functional validation (e.g., via `run_evaluation_example.ts`) ensures core evaluator capabilities, the development of comprehensive test suites covering diverse edge cases (e.g., for `ToolUsageEvaluator`: missing required tools, invalid arguments, multiple calls, different data sources) will be a dedicated effort during the unit test writing phase for each evaluator. This ensures robust coverage once the evaluator's primary functionality is stabilized.

We've built the foundation using a "tracer bullet" approach, establishing an end-to-end flow that validates the core architecture.

**Status Legend:**
*   🟢: Done
*   🟡: Needs Implementation/Refinement/Tests
*   🔴: Not Started

**Phase 1: Foundational Implementation (Largely Complete)**

1.  🟢 **Establish Module & Structure:** Created `agentdock-core/src/evaluation/` and sub-directories.
2.  🟢 **Define Core Interfaces & Types:** Implemented in `evaluation/types.ts`.
3.  🟢 **Basic Criteria Handling:** `EvaluationCriteria[]` defined and passed programmatically.
4.  🟢 **Evaluation Runner Implemented:** Core logic, evaluator instantiation from `evaluatorConfigs`, error handling, and score normalization with weighted aggregation are in place.
5.  🟢 **Basic Storage Implementation:** `JsonFileStorageProvider` implemented and functional.
6.  🟢 **RuleBasedEvaluator Implemented:** Supports regex, length, includes, json_parse rules.
7.  🟢 **LLMJudgeEvaluator Implemented:** Uses Vercel AI SDK's `generateObject` for structured output and `CoreLLM`.
8.  🟢 **Example Script (`run_evaluation_example.ts`):** Successfully demonstrates programmatic configuration and execution of the framework with both rule-based and LLM judges, outputting to console and JSONL file. Relocated to `examples/` directory.

**Phase 1.5: Core Enhancements & New Evaluator Types (Largely Complete)**

1.  🟢 **`NLPAccuracyEvaluator` Implementation (Semantic Similarity):**
    *   **Goal:** Evaluate how semantically similar an agent\'s response is to a ground truth reference.
    *   **Approach:** Created `agentdock-core/src/evaluation/evaluators/nlp/accuracy.ts`. This evaluator uses embedding models (e.g., via Vercel AI SDK or other compatible sentence transformer providers) to generate vector embeddings for both the agent\'s response and the `groundTruth` from `EvaluationInput`. It then calculates the cosine similarity between these embeddings. The resulting score (0-1 range) will represent the semantic accuracy.
    *   **Configuration:** `NLPAccuracyEvaluatorConfig` allows specifying the embedding model and criterion name.
    *   **Output:** `EvaluationResult` with the cosine similarity as the score.
    *   **Status:** Implemented and functionally tested via example script. Unit tests pending.
2.  🟢 **`ToolUsageEvaluator` Implementation:**
    *   **Goal:** Assess if an agent correctly used its designated tools.
    *   **Approach:** Created `agentdock-core/src/evaluation/evaluators/tool/usage.ts`. This rule-based evaluator checks for expected tool calls, validates argument structure/content via custom functions, and enforces required tool usage. It sources tool call data from `messageHistory` (structured `tool_call` and `tool_result` content parts) or `context`.
    *   **Configuration:** `ToolUsageEvaluatorConfig` takes an array of `ToolUsageRule`s (specifying `criterionName`, `expectedToolName`, `argumentChecks` function, `isRequired`) and a `toolDataSource` option.
    *   **Output:** `EvaluationResult` (typically binary pass/fail per rule) for criteria like \"ToolInvocationCorrectness\", \"ToolParameterAccuracy\".
    *   **Status:** Implemented and functionally tested via example script. Unit tests pending.

**Phase 1.6: Practical Lexical Evaluator Suite (New & Complete)**

This phase focuses on delivering a suite of fast, cost-effective, and practical lexical evaluators, providing essential checks without reliance on LLMs, aligning with a pragmatic evaluation philosophy.

1.  🟢 **`LexicalSimilarityEvaluator` Implementation:**
    *   **Goal:** Measure direct textual similarity between an agent\'s response and a reference.
    *   **Approach:** Implemented in `agentdock-core/src/evaluation/evaluators/lexical/similarity.ts`. Uses algorithms like Sorensen-Dice (default), Jaro-Winkler, or Levenshtein.
    *   **Configuration:** `LexicalSimilarityEvaluatorConfig` includes `criterionName`, `sourceField` (e.g., \'response\'), `referenceField` (e.g., \'groundTruth\'), `algorithm`, `caseSensitive`, `normalizeWhitespace`.
    *   **Output:** `EvaluationResult` with a normalized similarity score (0-1).
    *   **Status:** Implemented and functionally tested. Unit tests pending.
2.  🟢 **`KeywordCoverageEvaluator` Implementation:**
    *   **Goal:** Ensure key terms or concepts are present in the agent\'s response.
    *   **Approach:** Implemented in `agentdock-core/src/evaluation/evaluators/lexical/keyword_coverage.ts`. Calculates the percentage of `expectedKeywords` found in the `sourceTextField`.
    *   **Configuration:** `KeywordCoverageEvaluatorConfig` includes `criterionName`, `expectedKeywords` (or `keywordsSourceField` to pull from `groundTruth` or `context`), `sourceTextField`, `caseSensitive`, `matchWholeWord`, `normalizeWhitespace`.
    *   **Output:** `EvaluationResult` with a coverage score (0-1).
    *   **Status:** Implemented and functionally tested. Unit tests pending.
3.  🟢 **`SentimentEvaluator` Implementation:**
    *   **Goal:** Assess the emotional tone of the agent\'s response.
    *   **Approach:** Implemented in `agentdock-core/src/evaluation/evaluators/lexical/sentiment.ts`. Uses the `sentiment` npm package (AFINN-based wordlist).
    *   **Configuration:** `SentimentEvaluatorConfig` includes `criterionName`, `sourceTextField`, `outputType` (\'comparativeNormalized\', \'rawScore\', \'category\'), and thresholds for categorization.
    *   **Output:** `EvaluationResult` with a sentiment score or category.
    *   **Status:** Implemented and functionally tested. (Note: `sentiment` package is old, flagged for future review/replacement if needed). Unit tests pending.
4.  🟢 **`ToxicityEvaluator` Implementation:**
    *   **Goal:** Detect presence of undesirable or toxic language.
    *   **Approach:** Implemented in `agentdock-core/src/evaluation/evaluators/lexical/toxicity.ts`. Checks text against a list of `toxicTerms`.
    *   **Configuration:** `ToxicityEvaluatorConfig` includes `criterionName`, `toxicTerms`, `sourceTextField`, `caseSensitive`, `matchWholeWord`.
    *   **Output:** `EvaluationResult` with a binary score (true if not toxic, false if toxic).
    *   **Status:** Implemented and functionally tested. Unit tests pending.

**Phase 1.6.1: Initial Core Documentation (New & Complete)**

1.  🟢 **Detailed Evaluator Documentation:**
    *   **Goal:** Provide clear, comprehensive documentation for each implemented evaluator and for creating custom evaluators.
    *   **Approach:** Created individual Markdown files for each evaluator within the `docs/evaluations/evaluators/` directory. Each document includes an overview, core workflow (with a Mermaid diagram), use cases, configuration guidance (with a conceptual code example), and expected output details. A guide for creating custom evaluators (`custom-evaluators.md`) has also been created.
    *   **Covered Evaluators:** `RuleBasedEvaluator`, `LLMJudgeEvaluator`, `NLPAccuracyEvaluator`, `ToolUsageEvaluator`, and the Lexical Suite (`LexicalSimilarityEvaluator`, `KeywordCoverageEvaluator`, `SentimentEvaluator`, `ToxicityEvaluator`). An overview page for the Lexical Suite (`lexical-evaluators.md`) was also added.
    *   **Status:** Initial drafts complete and available in `docs/evaluations/`. The main `docs/evaluations/README.md` provides an overview and links.

**Phase 1.7: Comprehensive Testing (Next Up)**
1.  🟡 **Unit & Integration Tests:** Systematically add tests for all evaluators (RuleBased, LLMJudge, NLPAccuracy, ToolUsage, and all Lexical evaluators), detailed runner logic (including edge cases for normalization and aggregation), and storage provider interactions. Ensure robust mocking of external dependencies like LLMs.

**Phase 2: Advanced Features & Ecosystem Integration (Future Work)**

*   🔴 **Advanced Storage Solutions:** Implement `EvaluationStorageProvider` for robust backends (e.g., PostgreSQL, specialized MLOps databases).
*   🔴 **Sophisticated Aggregation & Reporting:** Allow for more complex aggregation strategies, configurable reporting formats, or basic statistical analysis on results.
*   🔴 **Agent-Level Evaluation Paradigms:** Develop patterns or specialized evaluators for assessing multi-turn conversation quality, complex task completion across multiple steps, or agent adherence to long-term goals.
*   🔴 **Configuration from Files:** Allow loading `EvaluationRunConfig` (or parts of it, like criteria sets or evaluator profiles) from static files (e.g., JSON, TS) for easier management of standard evaluation suites.
*   🔴 **Observability Enhancements:** Deeper integration with tracing/logging systems, potentially emitting OpenTelemetry-compatible evaluation events.
*   🔴 **UI/Dashboard for Results:** (Much Later) A dedicated interface for visualizing evaluation results, trends, and comparisons.

## 8. Adaptability: Design Principles for Future Growth

The long-term value of this framework hinges on its adaptability. We achieve this through:

*   **The `Evaluator` Interface:** This is the primary extension point. Any evaluation logic—custom business rules, advanced NLP metrics, statistical analysis, wrappers around external APIs (like commercial evaluation platforms), or even processors for human feedback—can be integrated by implementing this simple interface.
*   **The `EvaluationStorageProvider` Interface:** This decouples the evaluation execution from how results are persisted. Implementations can target relational databases, document stores, dedicated MLOps platforms, or cloud logging services without impacting the core runner.
*   **Flexible `EvaluationInput` Structure:** The input object is designed to be rich and extensible using `context` and `metadata` fields, allowing diverse types of information to be passed to evaluators without needing interface changes.
*   **Configuration-Driven Execution:** The `EvaluationRunner` operates based on the configuration it receives (which evaluators to run, criteria defined in the input, storage settings), rather than having evaluation logic hardcoded within it.
*   **Service Wrapping Potential:** The decoupled design, centered around the `runEvaluation` function and its configuration, ensures that the core logic can be easily wrapped within different deployment models in the future, such as a standalone HTTP microservice, if required for specific use cases like a centralized evaluation service.

This approach ensures that `agentdock-core` provides a solid foundation for evaluation without prescribing a specific methodology or locking users into proprietary tools. External platforms like DeepEval, TruLens, or LangSmith can be integrated by creating corresponding `Evaluator` wrappers that conform to our interface.