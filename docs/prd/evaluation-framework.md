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

**In Scope (Phase 1):**

*   **Core Architecture:** Define TypeScript interfaces (`EvaluationInput`, `EvaluationResult`, `EvaluationCriteria`, `AggregatedEvaluationResult`, `Evaluator`, `EvaluationStorageProvider`). These contracts are non-negotiable.
*   **Evaluation Runner:** Implement the `EvaluationRunner` orchestrator.
*   **Initial Evaluators:** Provide essential building blocks:
    *   `RuleBasedEvaluator`: For simple, fast, deterministic checks (e.g., keyword presence, length). Cheap, essential guardrails.
    *   `LLMJudgeEvaluator`: Use a configurable `CoreLLM` for nuanced quality assessment. Expensive but necessary for subjective measures.
*   **Criteria Definition:** Provide a mechanism to define/manage `EvaluationCriteria` sets (e.g., loading from config objects). Flexibility is required.
*   **Result Aggregation:** Implement basic aggregation in the runner (e.g., averaging, weighted scoring). Allow future customization.
*   **Storage Interface & Basic Implementation:** Define `EvaluationStorageProvider` interface. Provide a minimal default (e.g., append JSON to local file). This offers immediate utility. Scalable storage is future work; the interface enables it.
*   **Core Integration Points:** Define how `EvaluationRunner` should be invoked within `agentdock-core`.
*   **Unit Tests:** Implement comprehensive tests for core types, runner logic (mocking dependencies), initial evaluators, and storage provider contracts. Testability is mandatory.

**Out of Scope (Initial Version):**

*   **UI/Dashboard:** No frontend visualization. Focus is on the backend engine.
*   **Dedicated Scalable Database Backend:** Default file storage is for utility. Robust storage (PostgreSQL, MLOps DBs) requires separate `EvaluationStorageProvider` implementations later.
*   **Dedicated HTTP Service Layer:** Design must *allow* wrapping in a service, but building that service is out of scope for Phase 1.
*   **Specific 3rd-Party Tool Wrappers:** Won't build wrappers for DeepEval/TruLens initially, but the `Evaluator` interface must make this straightforward.
*   **Advanced NLP/Statistical Metrics:** Complex metrics (BLEU, ROUGE) can be added as custom `Evaluator` implementations later.
*   **Human Feedback Annotation UI:** Framework should *ingest* structured human feedback, but the UI for collection is external.

## 4. Functional Requirements: What It Must Do

*   **FR1: Define Evaluation Criteria:**
    *   Provide a clear mechanism to define individual evaluation criteria, including `name` (string, unique identifier), `description` (string, explanation for humans), `scale` (`EvaluationScale` enum/union type), and an optional `weight` (number, for weighted aggregation).
    *   Support loading or managing sets of these criteria for specific evaluation runs. Different applications or test suites will require different criteria sets.
*   **FR2: Implement Diverse Evaluators:**
    *   Define a standard `Evaluator` interface contract: `interface Evaluator { type: string; /* Unique identifier for the evaluator type */ evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]>; }`.
    *   **FR2.1 (Rule-Based):** Implement `RuleBasedEvaluator`. This evaluator must be configurable with a set of rules, where each rule is linked to a specific `EvaluationCriteria` (by name) and performs a deterministic check (e.g., regex match, length check, keyword count). It should provide fast, low-cost checks suitable for basic validation.
    *   **FR2.2 (LLM-as-Judge):** Implement `LLMJudgeEvaluator`. This evaluator must accept a configured `CoreLLM` instance. It needs robust prompt templating capabilities to instruct the judge LLM on how to assess the `EvaluationInput` against the provided `EvaluationCriteria`. Crucially, it must reliably parse the LLM's response to extract scores and reasoning for each criterion. This enables nuanced, qualitative assessments.
    *   **FR2.3 (Extensibility):** The framework MUST make it straightforward for developers to create and integrate their own custom `Evaluator` classes by simply implementing the `Evaluator` interface. This is the primary hook for custom logic, integrating third-party tools, or adding specialized metrics, preventing vendor lock-in and ensuring long-term adaptability.
*   **FR3: Execute Evaluations Systematically:**
    *   The `EvaluationRunner` component is responsible for orchestrating the evaluation process.
    *   It must accept an `EvaluationInput` object, an array of `EvaluationCriteria` to evaluate against, and an array of `Evaluator` instances to use.
    *   It must iterate through the configured evaluators, invoking their `evaluate` method with the input and relevant criteria.
    *   It must handle errors gracefully at the individual evaluator level (e.g., log an error for a failing evaluator but continue with others if possible), returning partial results if necessary.
    *   Where practical (especially for IO-bound operations like the `LLMJudgeEvaluator`), evaluation execution should leverage asynchronous operations (`Promise`) to avoid blocking.
    *   It must collect all successfully generated `EvaluationResult` objects from the evaluators.
*   **FR4: Aggregate Evaluation Results:**
    *   The `EvaluationRunner` (or a dedicated helper component) must aggregate the collected list of `EvaluationResult[]` into a single `AggregatedEvaluationResult` object.
    *   It must support basic aggregation strategies initially, such as calculating a weighted average score based on the `weight` defined in the `EvaluationCriteria` and the `score` in the `EvaluationResult`.
    *   The aggregation logic should be designed to allow for potential future customization or alternative strategies.
*   **FR5: Store Evaluation Results Persistently:**
    *   Define a clear, serializable schema for the `AggregatedEvaluationResult` object. This object must capture essential information for reproducibility and analysis, including a snapshot of the `EvaluationInput`, the individual `EvaluationResult` items, the calculated overall score(s), relevant metadata (timestamps, agent IDs, session IDs), and potentially a snapshot of the evaluation configuration used.
    *   Define a standard `EvaluationStorageProvider` interface: `interface EvaluationStorageProvider { saveResult(result: AggregatedEvaluationResult): Promise<void>; }`.
    *   Provide a minimal, functional default implementation, `JsonFileStorageProvider`, which appends the serialized `AggregatedEvaluationResult` to a specified file path. This ensures out-of-the-box usability for simple logging or local testing.
*   **FR6: Integrate with Core AgentDock:**
    *   Define and document clear, idiomatic ways to invoke the `EvaluationRunner` from within `agentdock-core` applications (e.g., after a message is handled by an agent node, or as part of a dedicated testing utility).
    *   A primary invocation API should be exposed, potentially looking like:
        ```typescript
        interface EvaluationRunConfig {
          evaluators: Evaluator[]; // Instances of configured evaluators
          criteria: EvaluationCriteria[]; // The criteria set for this run
          storageProvider?: EvaluationStorageProvider; // Optional: defaults to JsonFileStorageProvider
          // Potentially other runner-specific settings like aggregation strategy
        }

        // Function to trigger an evaluation run
        async function runEvaluation(
          input: EvaluationInput, // The data to evaluate
          config: EvaluationRunConfig // Configuration for the run
        ): Promise<AggregatedEvaluationResult>; // Returns the aggregated results
        ```
    *   The internal design of the runner and its dependencies must facilitate wrapping this core `runEvaluation` logic within an external interface (like an HTTP service) in future applications or specialized deployment scenarios without requiring significant refactoring of the core evaluation logic.
    *   Clearly define how evaluation configurations (criteria, evaluator selection, settings) are passed to the runner (see NFR2 & Configuration Options).

## 5. Non-Functional Requirements: Ensuring Production Readiness

Beyond just features, the framework must be built for real-world use.

*   **NFR1: Modularity & Extensibility:** This is paramount. The design must heavily rely on interfaces (`Evaluator`, `EvaluationStorageProvider`) to ensure loose coupling. Adding new evaluation methods or storage backends should require *no* changes to the core `EvaluationRunner`. The architecture must inherently support different deployment models (e.g., running evaluations as an in-process library call vs. wrapping the core logic in a separate microservice). This future-proofs the framework.
*   **NFR2: Configurability:** Users must be able to easily configure evaluation runs: selecting which evaluators to use, defining the criteria set, adjusting settings for specific evaluators (e.g., the LLM model for the judge), and specifying the storage provider. Usability depends on good configuration options.
    *   **Configuration Strategy Options (To be finalized during implementation):**
        *   **Programmatic (Primary for Phase 1):** Allow passing configuration objects directly to the `runEvaluation` function (as shown in the FR6 example). This is simple and flexible for direct integration.
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
    *   `EvaluationScale = 'binary' | 'likert5' | 'numeric' | 'pass/fail' | string;` // Allow common scales + custom string scales
    *   `EvaluationCriteria`: `{ name: string; // Unique identifier for the criterion description: string; // Human-readable explanation scale: EvaluationScale; // The scale used for scoring this criterion weight?: number; // Optional weight for aggregation }`
    *   `EvaluationInput`: `{ // Rich context for the evaluation prompt?: string; // Optional initiating prompt response: string | AgentMessage; // The agent output being evaluated context?: Record<string, any>; // Arbitrary contextual data groundTruth?: string | any; // Optional reference answer/data criteria: EvaluationCriteria[]; // Criteria being evaluated against agentConfig?: Record<string, any>; // Snapshot of agent config at time of response messageHistory?: AgentMessage[]; // Relevant message history timestamp?: number; // Timestamp of the response generation sessionId?: string; // Identifier for the session/conversation agentId?: string; // Identifier for the agent instance metadata?: Record<string, any>; // Other arbitrary metadata }`
    *   `EvaluationResult`: `{ // Result for a single criterion from one evaluator criterionName: string; // Links back to EvaluationCriteria.name score: number | boolean | string; // The actual score/judgment reasoning?: string; // Optional explanation from the evaluator (esp. LLM judge) evaluatorType: string; // Identifier for the evaluator producing this result error?: string; // Error message if this specific evaluation failed metadata?: Record<string, any>; // Evaluator-specific metadata }`
    *   `AggregatedEvaluationResult`: `{ // Overall result for an evaluation run overallScore?: number; // Optional aggregated score (e.g., weighted avg) results: EvaluationResult[]; // List of individual results from all evaluators timestamp: number; // Timestamp of the evaluation run completion agentId?: string; // Copied from input sessionId?: string; // Copied from input inputSnapshot: EvaluationInput; // Capture the exact input used evaluationConfigSnapshot?: any; // Snapshot of criteria, evaluators used metadata?: Record<string, any>; // Run-level metadata }`
    *   `Evaluator`: `interface Evaluator { type: string; evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]>; }`
    *   `EvaluationStorageProvider`: `interface EvaluationStorageProvider { saveResult(result: AggregatedEvaluationResult): Promise<void>; }`
*   **Sub-directories & Components:**
    *   `evaluation/criteria/`: Utilities or helpers related to defining/managing criteria sets (if needed beyond simple objects).
    *   `evaluation/evaluators/`: Implementations of the `Evaluator` interface (`rule_based.ts`, `llm_judge.ts`, etc.).
    *   `evaluation/runner/`: Implementation of the `EvaluationRunner` logic (`index.ts`).
    *   `evaluation/storage/`: The `EvaluationStorageProvider` interface definition and concrete implementations (`json_file_storage.ts`, potentially others later).
    *   `evaluation/types.ts`: Location for all core type definitions and interfaces listed above.
    *   `evaluation/index.ts`: Main entry point exporting the public API of the evaluation module (e.g., `runEvaluation` function, core types, interfaces).

## 7. Where We Start: Phased Implementation (Phase 1 Focus)

We'll build the foundation first using a "tracer bullet" approach: establish the simplest possible end-to-end flow to validate the core architecture before adding complexity.

1.  **Establish Module & Structure:** Create the `agentdock-core/src/evaluation/` directory and the planned sub-directories (`types`, `runner`, `storage`, `evaluators`).
2.  **Define Core Interfaces:** Implement all the TypeScript interfaces and type aliases detailed in section 6 within `evaluation/types.ts`. Critically, define the `Evaluator` and `EvaluationStorageProvider` interfaces accurately.
3.  **Basic Criteria Handling:** Ensure `EvaluationCriteria[]` can be defined and passed programmatically to the runner. No complex loading mechanism needed initially.
4.  **Basic Runner Skeleton:** Create `evaluation/runner/index.ts`. Implement the core `EvaluationRunner` class or function. It should accept `EvaluationInput`, `EvaluationCriteria[]`, and `Evaluator[]`. Implement the basic loop to call `evaluate` on each evaluator (with basic `try/catch` for error handling per evaluator). Initially, aggregation can simply involve collecting all returned `EvaluationResult` objects into the `AggregatedEvaluationResult`.
5.  **Basic Storage Implementation:** Create `evaluation/storage/json_file_storage.ts`. Implement the `EvaluationStorageProvider` interface by appending the serialized `AggregatedEvaluationResult` to a specified file path.
6.  **Unit Tests:** Add initial Jest/Vitest unit tests covering:
    *   Correctness of type definitions.
    *   Basic `EvaluationRunner` flow (using mock evaluators and a mock storage provider).
    *   Contract adherence of the `JsonFileStorageProvider` (mocking file system interactions).

Subsequent phases will build out the specific `RuleBasedEvaluator` and `LLMJudgeEvaluator`, refine the result aggregation logic, enhance the core integration points, and add more comprehensive tests.

## 8. Adaptability: Design Principles for Future Growth

The long-term value of this framework hinges on its adaptability. We achieve this through:

*   **The `Evaluator` Interface:** This is the primary extension point. Any evaluation logic—custom business rules, advanced NLP metrics, statistical analysis, wrappers around external APIs (like commercial evaluation platforms), or even processors for human feedback—can be integrated by implementing this simple interface.
*   **The `EvaluationStorageProvider` Interface:** This decouples the evaluation execution from how results are persisted. Implementations can target relational databases, document stores, dedicated MLOps platforms, or cloud logging services without impacting the core runner.
*   **Flexible `EvaluationInput` Structure:** The input object is designed to be rich and extensible using `context` and `metadata` fields, allowing diverse types of information to be passed to evaluators without needing interface changes.
*   **Configuration-Driven Execution:** The `EvaluationRunner` operates based on the configuration it receives (which evaluators to run, which criteria to apply, storage settings), rather than having evaluation logic hardcoded within it.
*   **Service Wrapping Potential:** The decoupled design, centered around the `runEvaluation` function and its configuration, ensures that the core logic can be easily wrapped within different deployment models in the future, such as a standalone HTTP microservice, if required for specific use cases like a centralized evaluation service.

This approach ensures that `agentdock-core` provides a solid foundation for evaluation without prescribing a specific methodology or locking users into proprietary tools. External platforms like DeepEval, TruLens, or LangSmith can be integrated by creating corresponding `Evaluator` wrappers that conform to our interface. 