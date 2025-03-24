# Orchestration Configuration

This document details how to configure orchestration behavior for AgentDock agents using the agent template (`template.json` or similar).

## Structure

Orchestration is defined within the main agent configuration under the top-level `orchestration` key:

```json
{
  "id": "research-planner",
  "name": "Research and Planning Agent",
  "description": "An agent that performs research and planning.",
  "llm": {
    "provider": "openai",
    "model": "gpt-4-turbo"
  },
  "tools": ["web_search", "think", "list_generation"],
  "orchestration": {
    "description": "Manages transitions between research and planning modes.",
    "defaultStep": "idle",
    "steps": [
      // Step definitions go here...
    ]
  }
}
```

-   `orchestration`: The main object containing all orchestration settings.
-   `description`: Optional description of the orchestration workflow.
-   `defaultStep`: (Optional) The name of the step to activate if no other step's conditions are met. If omitted, the agent might operate without a specific step active initially or fall back to allowing all configured tools.
-   `steps`: An array of orchestration step objects.

## Step Definition

Each object in the `steps` array defines an orchestration step:

```json
{
  "name": "research_mode",
  "description": "Step for active research using web search.",
  "conditions": [
    {
      "type": "message_contains",
      "value": "research"
    }
  ],
  "availableTools": {
    "allowed": ["web_search", "think", "*cognitive*"],
    "denied": []
  },
  "sequence": [
    "web_search",
    "think"
  ],
  "resetSequenceOn": ["message_contains"]
}
```

### Core Step Properties:

-   `name` (Required): A unique identifier string for the step (e.g., `research_mode`, `planning`, `code_review`).
-   `description` (Optional): A human-readable description of the step's purpose.

### `conditions`

-   (Optional) An array of condition objects. **All** conditions must be met for this step to become active.
-   See [Conditional Transitions](./conditional-transitions.md) for available condition `type`s and `value` formats.
-   If `conditions` is omitted or empty, the step can only be activated if it's the `defaultStep` or potentially via direct API control (if implemented).

### `availableTools`

-   (Optional) An object controlling which tools are accessible when this step is active.
-   `allowed`: An array of tool names or wildcards (e.g., `*cognitive*`) that are permitted.
-   `denied`: An array of tool names or wildcards that are explicitly forbidden, even if matched by `allowed`.
-   **Behavior:**
    -   If `availableTools` is omitted, all tools configured for the agent are implicitly allowed.
    -   If only `allowed` is present, only those tools are available.
    -   If only `denied` is present, all tools *except* those denied are available.
    -   If both are present, tools are allowed if they match `allowed` AND do not match `denied`.
    -   Tool filtering is applied *before* sequence filtering.

### `sequence`

-   (Optional) An array of tool name strings defining a required order of execution.
-   See [Step Sequencing](./step-sequencing.md) for details on how sequences are enforced.
-   Tools listed here must also be permitted by the `availableTools` configuration for this step.

### `resetSequenceOn` (Planned Enhancement)

-   *(Currently Not Implemented)* An array of event types that *could* cause the `sequenceIndex` for this step to be reset to 0 if the step is active.
-   **Conceptual Values:**
    -   `message_received`: Reset when a new user message arrives.
    -   `step_deactivated`: Reset when this step is no longer the active step.
-   **Purpose:** Would allow sequences to restart automatically under certain conditions (like user interruption), improving robustness.

## Example: Research & Planning Agent

```json
{
  "id": "research-planner",
  "name": "Research and Planning Agent",
  "tools": ["web_search", "think", "summarize", "list_generation"],
  "orchestration": {
    "description": "Switches between research and planning phases.",
    "defaultStep": "planning",
    "steps": [
      {
        "name": "research",
        "description": "Gather information using search.",
        "conditions": [
          {
            "type": "message_contains",
            "value": "research"
          },
          {
            "type": "message_contains",
            "value": "find"
          }
        ],
        "availableTools": {
          "allowed": ["web_search", "think", "summarize"],
          "denied": ["list_generation"]
        },
        "sequence": [
          "web_search",
          "summarize"
        ]
      },
      {
        "name": "planning",
        "description": "Plan next steps or generate lists.",
        "conditions": [
          {
            "type": "message_contains",
            "value": "plan"
          }
        ],
        "availableTools": {
          "allowed": ["think", "list_generation"],
          "denied": ["web_search", "summarize"]
        }
      }
    ]
  }
}
```

**Behavior:**

-   Starts in the `planning` step (default).
-   If the user message contains "plan", it stays in/moves to the `planning` step (tools: `think`, `list_generation`).
-   If the user message contains *both* "research" and "find", it transitions to the `research` step.
-   In the `research` step, the agent must first use `web_search`, then `summarize`. Only the next required tool is available at each stage of the sequence. `think` is also generally allowed but won't be presented by the sequencer if `web_search` or `summarize` is pending.
-   If the user says something that doesn't trigger "research" or "plan", it defaults back to the `planning` step.

## Best Practices

-   Start simple and add complexity gradually.
-   Define a sensible `defaultStep`.
-   Ensure tools in `sequence` are included in `availableTools.allowed`.
-   Use clear and distinct `name` properties for steps.
-   Test conditions thoroughly to ensure expected transitions. 