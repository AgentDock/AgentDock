# Conditional Transitions

This document explains how AgentDock manages transitions between different orchestration steps based on defined conditions.

## Core Concept

Conditional transitions allow the agent's behavior (specifically, the active orchestration step and thus the available tools) to change dynamically based on the agent's past actions within the current session.

## Configuration

Conditions are defined within each step in the agent's orchestration configuration (`template.json`):

```json
{
  "name": "post_analysis_step",
  "description": "Activate after the 'think' tool has been used.",
  "conditions": [
    {
      "type": "tool_used",
      "value": "think"
    }
  ],
  "availableTools": {
    "allowed": ["summarize", "save_result"]
  }
}
```

-   Each step can have a `conditions` array.
-   A step becomes active only if **all** conditions within its array are met simultaneously (logical AND).
-   Each condition object has a `type` and a `value`.

## Implemented Condition Types

Currently, the following condition types are implemented in `agentdock-core`:

-   **`tool_used`**: Checks if the specified tool name (`value`) exists *anywhere* in the session's `recentlyUsedTools` list.
    -   Example: `{ "type": "tool_used", "value": "search" }`
-   **`sequence_match`**: Checks if the *end* of the session's `recentlyUsedTools` list exactly matches the `sequence` array defined for the step being evaluated. This is useful for activating steps only after a specific series of tools has been used in order.
    -   Does *not* use the `value` field.
    -   Example: `{ "type": "sequence_match" }` (used on a step that has a `sequence` array defined).

## Implementation (`OrchestrationManager`)

The logic for evaluating conditions resides within the `OrchestrationManager` (`agentdock-core/src/orchestration/index.ts`).

### Key Logic:

-   **Access to State:** The condition evaluation logic needs access to the current `OrchestrationState` for the session (from `OrchestrationStateManager`), specifically the `recentlyUsedTools` list.
-   **Evaluation Flow:**
    1.  Triggered typically at the beginning of processing a new user message (before determining available tools for the LLM call).
    2.  **Additionally**, evaluation is now triggered immediately *after* a tool usage event is processed (`processToolUsage`). This ensures that step transitions based on completed sequences happen within the same turn.
    3.  Iterates through all defined orchestration steps in the configuration.
    4.  For each step, evaluates **all** of its defined `conditions` (e.g., `tool_used`, `sequence_match`) against the current state.
    5.  If **all** conditions for a step pass, that step is considered a candidate for activation.
-   **Step Activation:**
    -   If one or more steps meet their conditions, a strategy selects the active step (typically the first matching step in the configuration order).
    -   The `OrchestrationStateManager.setActiveStep` method updates the session's state with the name of the newly activated step.
    -   If no step's conditions are met, the system might fall back to a default step or maintain the current `activeStep`.

## How it Works (Example Flow)

1.  **Initial State:** Session starts, maybe in a default "general" step. `recentlyUsedTools` is empty.
2.  **User Action / LLM Response:** The agent uses the `think` tool.
3.  **State Update:** `OrchestrationStateManager.addUsedTool(sessionId, "think")` is called. `recentlyUsedTools` now contains `["think"]`.
4.  **Next Interaction - Condition Check:** Before the next LLM call, the `OrchestrationManager` evaluates conditions:
    -   Step "general" (Default) -> May remain candidate.
    -   Step "post_analysis_step" (`tool_used`: "think") -> Condition is checked against `recentlyUsedTools`. It passes.
5.  **Step Activation:** Since conditions for "post_analysis_step" passed, it becomes the active step. `OrchestrationStateManager.setActiveStep(sessionId, "post_analysis_step")` is called.
6.  **Tool Availability:** On the next turn, when the LLM asks for tools, the system provides only those allowed in "post_analysis_step" (e.g., `summarize`, `save_result`).

## Multi-Agent Relevance

In the planned [Orchestration-Driven Personas](./../roadmap/multi-agent-collaboration.md) model for multi-agent collaboration:

-   The `tool_used` condition could trigger transitions between different agent personas/steps.
-   For example, after a "Researcher" persona (step) uses `web_search` and `summarize`, a `tool_used: summarize` condition could activate a "Planner" persona (step) to process the summary.

## Considerations

-   **Limited Conditions:** The current implementation only supports `tool_used`. Expanding condition types (e.g., based on message content, state values) would require adding more cases to the `checkCondition` logic in `OrchestrationManager`.
-   **Condition Order:** The order of steps in the configuration matters if multiple steps depend on the same `tool_used` condition.
-   **Statefulness:** Conditions rely heavily on accurate session state (`recentlyUsedTools`).
-   **Relying on Model Intelligence:** As frontier LLMs become increasingly capable of understanding context and following complex instructions, overly rigid constraints (like numerous, complex condition types or strict sequences) might become less necessary or even counterproductive. Future development may explore balancing explicit orchestration rules with leveraging the model's inherent planning and reasoning abilities, potentially simplifying configuration while maintaining reliable task execution. 
1.  **Initial State:** Session starts, no specific step active (or a default step).
2.  **User Message:** User sends a message: "Okay, let's plan the project structure."
3.  **Condition Check:** The orchestration system evaluates conditions for all steps:
    -   Step "research" (`message_contains`: "research") -> Fails.
    -   Step "planning_mode" (`message_contains`: "plan") -> Passes.
    -   Step "planning_mode" (`not_recently_used`: "web_search", `window`: 3) -> Passes (assuming `web_search` wasn't just used).
4.  **Step Activation:** Since both conditions for "planning_mode" passed, it becomes the active step. `OrchestrationStateManager.setActiveStep(sessionId, "planning_mode")` is called.
5.  **Tool Availability:** On the next turn, when the LLM asks for tools, the system provides only those allowed in "planning_mode" (e.g., `think`, `list_generation`).
6.  **Further Interaction:** If the user later says "research caching strategies", the conditions might re-evaluate, potentially activating the "research" step and changing the available tools.

## Considerations

-   **Condition Order:** The order of steps in the configuration can matter if multiple steps' conditions might be met simultaneously (first match usually wins).
-   **Specificity:** Conditions should be specific enough to avoid unintended step changes but general enough to capture user intent.
-   **Complexity:** Overly complex conditions or numerous steps can make agent behavior hard to predict or debug.
-   **Statefulness:** Conditions rely heavily on accurate session state (`activeStep`, `recentlyUsedTools`). 