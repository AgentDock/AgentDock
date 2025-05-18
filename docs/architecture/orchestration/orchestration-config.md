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

- `orchestration`: The main object containing all orchestration settings.
- `description`: Optional description of the orchestration workflow.
- `defaultStep`: (Optional) The name of the step to activate if no other step's conditions are met. If omitted, the agent might operate without a specific step active initially or fall back to allowing all configured tools.
- `steps`: An array of orchestration step objects.

## Step Definition

Each object in the `steps` array defines an orchestration step:

```json
{
  "name": "research_mode",
  "description": "Step for active research using web search.",
  "conditions": [
    {
      "type": "tool_used",
      "value": "search"
    },
    {
      "type": "sequence_match"
    }
  ],
  "availableTools": {
    "allowed": ["web_search", "think", "*cognitive*"],
    "denied": []
  },
  "sequence": ["web_search", "think"],
  "resetSequenceOn": ["message_contains"]
}
```

### Core Step Properties:

- `name` (Required): A unique identifier string for the step (e.g., `research_mode`, `planning`, `code_review`).
- `description` (Optional): A human-readable description of the step's purpose.

### `conditions` (Array, Optional)

An array of condition objects that must _all_ be met for this step to become active.

- Each object in the array represents a single condition.
- If this array is omitted or empty, the step has no activation conditions (other than potentially being the `isDefault` step).

#### Condition Object

```json
{
  "type": "tool_used" | "sequence_match",
  "value": "string (required for type='tool_used', unused for type='sequence_match')",
  "description": "string (optional)"
}
```

- `type` (String, Required): The type of condition to check. Valid types:
  - `tool_used`: Checks if the tool specified in `value` exists in the session's `recentlyUsedTools` history.
  - `sequence_match`: Checks if the end of the `recentlyUsedTools` history matches the `sequence` defined for this step.
- `value` (String, Conditional): The value associated with the condition.
  - **Required** if `type` is `tool_used` (specifies the tool name).
  - **Not used** (and should be omitted) if `type` is `sequence_match`.
- `description` (String, Optional): A human-readable description of the condition's purpose.

### `availableTools`

- (Optional) An object controlling which tools are accessible when this step is active.
- `allowed`: An array of tool names or wildcards (e.g., `*cognitive*`) that are permitted.
- `denied`: An array of tool names or wildcards that are explicitly forbidden, even if matched by `allowed`.
- **Behavior:**
  - If `availableTools` is omitted, all tools configured for the agent are implicitly allowed.
  - If only `allowed` is present, only those tools are available.
  - If only `denied` is present, all tools _except_ those denied are available.
  - If both are present, tools are allowed if they match `allowed` AND do not match `denied`.

### `sequence` (Array, Optional)

- An array of tool name strings defining a required order of execution for this step.
- When a step with a sequence is active, the `StepSequencer` typically restricts available tools to only the _next_ tool required in the sequence.
- Tools listed here should generally also be permitted by the `availableTools` configuration for this step.
- See [Step Sequencing](./step-sequencing.md) for more details.
