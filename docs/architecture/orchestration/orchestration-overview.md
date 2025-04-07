# Orchestration Framework Overview

Orchestration in AgentDock provides a structured way to control agent behavior, manage tool availability across different states (steps), and define sequences for complex tasks. It enables more guided, reliable, and focused agent interactions compared to allowing unrestricted tool use.

## Core Concepts

-   **Steps (or Modes):** Discrete states within an agent's workflow (e.g., `research`, `planning`, `code_generation`). Each step defines specific behaviors.
-   **Conditions:** Rules that trigger transitions *between* steps based on context (user messages, tool usage). See [Conditional Transitions](./conditional-transitions.md).
-   **Tool Availability:** Each step configuration dictates which tools are allowed or denied when that step is active.
-   **Sequencing:** Within a step, a specific order of tool execution can be enforced. See [Step Sequencing](./step-sequencing.md).
-   **Session State:** Orchestration relies heavily on session-specific state (`OrchestrationState`) to track the active step, tool usage history, and sequence progress. See [State Management](./state-management.md).

## Architecture & Implementation

Key components work together, managed primarily within the `agentdock-core/src/orchestration` directory:

1.  **Configuration:** Defined in the agent template (`template.json`), specifying steps, conditions, tool availability, and sequences. See [Orchestration Configuration](./orchestration-config.md).
2.  **`OrchestrationStateManager`:** Manages the `OrchestrationState` for each session, using the core `SessionManager` and configured storage provider.
3.  **`StepSequencer`:** Enforces tool sequences defined within steps, interacting with the `OrchestrationStateManager` to track progress (`sequenceIndex`).
4.  **Condition Evaluation Logic:** Determines which step should be active based on configured conditions and current context (message content, `OrchestrationState`). This logic coordinates reading state and triggering state updates.
5.  **Tool Filtering:** Combines the `availableTools` configuration from the active step and the `StepSequencer`'s filtering to determine the exact set of tools available to the LLM at any given moment.

## Flow of Operation

1.  **Initialization:** An agent instance loads its orchestration configuration.
2.  **Interaction Received (e.g., User Message):**
    a.  The system retrieves or creates the `OrchestrationState` for the session using `OrchestrationStateManager`.
    b.  Condition evaluation logic checks the message content and current state against the conditions defined for all steps.
    c.  If conditions for a new step are met, `OrchestrationStateManager.setActiveStep` updates the state.
3.  **Tool Availability Determination:**
    a.  The system identifies the `activeStep` from the `OrchestrationState`.
    b.  It retrieves the `availableTools` (allowed/denied lists) from the active step's configuration.
    c.  It applies initial filtering based on `availableTools`.
    d.  It calls `StepSequencer.filterToolsBySequence` with the filtered list. If a sequence is active, this further restricts the list, often to a single tool.
    e.  The final, filtered list of tools is provided to the LLM.
4.  **Tool Execution:**
    a.  The LLM selects and invokes a tool from the provided list.
    b.  The tool executes.
5.  **Post-Tool Processing:**
    a.  `OrchestrationStateManager.addUsedTool` records the tool usage.
    b.  If a sequence was active, `StepSequencer.processTool` is called to potentially advance the `sequenceIndex`.
    c.  Condition evaluation logic *may* run again to check if the tool usage triggers a step transition.

## Benefits

-   **Guided Workflows:** Ensures agents follow specific processes for complex tasks.
-   **Improved Reliability:** Prevents agents from using inappropriate tools or getting stuck.
-   **Focused Interactions:** Limits the LLM's choices, potentially improving response quality and reducing hallucination.
-   **Stateful Control:** Enables dynamic behavior changes based on conversation history and context.

## Integration Points

-   **Session Management:** Relies fundamentally on session state isolation and management.
-   **Agent Configuration:** Defined via agent templates.
-   **LLM Interaction:** Controls the tools presented to the LLM.