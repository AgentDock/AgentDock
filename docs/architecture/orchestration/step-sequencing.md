# Step Sequencing

This document explains how AgentDock enforces tool sequences within orchestration steps, ensuring tools are used in the intended order for structured tasks.

## Core Concept

Some orchestration steps require tools to be executed in a specific order. For example, a research task might require:

1.  `web_search`
2.  `think` (to analyze results)
3.  `summarize` (to condense findings)

The sequencing feature ensures the agent follows this prescribed order.

## Configuration

Sequences are defined within an orchestration step's configuration in the agent template:

```json
{
  "name": "structured_research",
  "description": "Perform research following a specific sequence.",
  "availableTools": {
    "allowed": ["web_search", "think", "summarize", "*cognitive*"]
  },
  "sequence": ["web_search", "think", "summarize"]
}
```

- The `sequence` array lists the tool names in the required order.
- Tools listed in the sequence must also be included in `availableTools` (directly or via wildcard).

## Implementation (`StepSequencer`)

The `StepSequencer` class (`agentdock-core/src/orchestration/sequencer.ts`) manages sequence logic.

### Key Features:

- **State Dependency:** Relies on the `OrchestrationStateManager` to read and write the `sequenceIndex` within the `OrchestrationState` for the current session.
- **Sequence Tracking:**
  - `hasActiveSequence(step, sessionId)`: Checks if a step has a sequence and if the current `sequenceIndex` is within the bounds of that sequence.
  - `getCurrentSequenceTool(step, sessionId)`: Returns the name of the tool expected at the current `sequenceIndex`.
  - `advanceSequence(step, sessionId)`: Increments the `sequenceIndex` in the session's `OrchestrationState`.
- **Tool Processing:**
  - `processTool(step, sessionId, usedTool)`: Called when a tool is used. It checks if the `usedTool` matches the `getCurrentSequenceTool`. If it matches, it calls `advanceSequence`. If not, it logs a warning.
- **Tool Filtering:**
  - `filterToolsBySequence(step, sessionId, allToolIds)`: This is the core enforcement mechanism. If a sequence is active for the step, this method checks the `getCurrentSequenceTool`. If that tool exists in the `allToolIds` list (tools generally available for the step), it returns _only_ that tool name. Otherwise (sequence finished, expected tool not available), it may return all tools or an empty list depending on the exact logic (currently returns `[]` if the expected tool isn't available, effectively blocking progress if the configuration is inconsistent).

## How it Works

1.  **Step Activation:** When an orchestration step with a `sequence` becomes active, the `OrchestrationStateManager` ensures the `sequenceIndex` in the session's state is initialized (usually to 0).
2.  **Tool Availability Request:** When the core system (e.g., `AgentNode`) asks for available tools for the LLM:
    a. It determines the active step.
    b. It gets the generally allowed tools for that step (based on `availableTools` config).
    c. It calls `StepSequencer.filterToolsBySequence` passing the step, session ID, and allowed tools.
    d. If a sequence is active and the expected tool is available, `filterToolsBySequence` returns _only_ that tool's name.
    e. The LLM is only presented with the single allowed tool for the current sequence step.
3.  **Tool Execution:** The LLM invokes the required tool.
4.  **Sequence Advancement:** After the tool executes, the system calls `StepSequencer.processTool`:
    a. If the executed tool matches the expected sequence tool, `processTool` calls `advanceSequence` to increment the `sequenceIndex` in the session state.
    b. If the tool doesn't match (which shouldn't happen if filtering works correctly, but handled defensively), a warning is logged.
5.  **Next Step:** On the next interaction, the process repeats. `filterToolsBySequence` will now look for the tool at the _new_ `sequenceIndex`.
6.  **Sequence Completion:** Once the `sequenceIndex` reaches the length of the `sequence` array, `getCurrentSequenceTool` returns `null`, and `filterToolsBySequence` allows all tools generally available for the step (or falls back to default step behavior).

## Considerations

- **Configuration Consistency:** Tools in the `sequence` must be available in the step's `availableTools` definition.
- **Error Handling:** The current implementation logs warnings if the sequence is violated or the expected tool isn't available. More robust error handling or alternative behaviors (like resetting the sequence) could be added.
- **LLM Compliance:** This relies on the LLM correctly using only the single tool provided to it when a sequence is active.

## Sequence Concepts

### What is a Tool Sequence?

A tool sequence defines an ordered list of tools that must be used in a specific order. This creates a guided workflow that helps agents complete complex tasks methodically.

Sequences can be used to:

- Enforce methodical problem-solving approaches
- Guide agents through complex workflows
- Ensure critical steps are not skipped
- Create structured reasoning patterns

### Sequence Representation

Sequences are represented in step configurations as arrays:

```json
"sequence": [
  "think",
  "web_search",
  "summarize"
]
```

This sequence requires the agent to:

1. First use the "think" tool
2. Then use the "web_search" tool
3. Finally use the "summarize" tool

### Flexible Sequences

For more flexibility, sequences can include groups of tools at each position:

```json
"sequence": [
  ["think", "reflect"],  // First position: either think OR reflect
  "web_search",          // Second position: web_search
  ["summarize", "save"]  // Third position: either summarize OR save
]
```

This allows multiple valid paths through the sequence while maintaining the overall structure.

## Sequence Enforcement Across Environments

One key improvement in our system is that sequence enforcement works consistently across all environments, including serverless deployments.

### Always Enforced

Previously, sequence enforcement was conditionally applied:

```typescript
// Old approach - sequences were only enforced under certain conditions
if (!this.lightweight && activeStep.sequence?.length) {
  return this.sequencer.filterToolsBySequence(activeStep, sessionId, allToolIds);
}
```

Now, sequences are always enforced:

```typescript
// New approach - sequences are always enforced
if (activeStep.sequence?.length) {
  return this.sequencer.filterToolsBySequence(activeStep, sessionId, allToolIds);
}
```

### Why This Matters

This change ensures that:

1. **Consistent Agent Behavior**: Agents behave the same way in all environments
2. **Structured Thinking**: Steps like "critique → debate → reflect" are properly enforced
3. **Reliable Sequences**: Users can count on sequences working as designed
4. **Without Performance Penalty**: Sequence enforcement has minimal overhead

### Implementation Details

The key method that filters tools based on sequences:

```typescript
public filterToolsBySequence(
  step: OrchestrationStep,
  sessionId: SessionId,
  allToolIds: string[]
): string[] {
  // If no active sequence, return all tools
  if (!this.hasActiveSequence(step, sessionId)) return allToolIds;

  const currentTool = this.getCurrentSequenceTool(step, sessionId);
  if (!currentTool) return allToolIds;

  // If current tool is available, only allow that tool
  if (allToolIds.includes(currentTool)) {
    return [currentTool];
  }

  // Current tool not available
  logger.warn(
    LogCategory.ORCHESTRATION,
    'StepSequencer',
    'Current sequence tool not available',
    {
      sessionId,
      step: step.name,
      currentTool
    }
  );

  return allToolIds;
}
```

This ensures that only the current tool in the sequence is available to the agent until the sequence advances.

## Integration with Tool Filtering

The orchestration manager provides a method to get allowed tools, which integrates sequence filtering with other filtering mechanisms:

```typescript
public getAllowedTools(
  orchestration: OrchestrationConfig,
  messages: LLMMessage[],
  sessionId: SessionId,
  allToolIds: string[]
): string[] {
  // If no orchestration, return all tools
  if (!orchestration?.steps?.length) return allToolIds;

  // Get active step
  const activeStep = this.getActiveStep(orchestration, messages, sessionId);

  // If no active step, return all tools
  if (!activeStep) return allToolIds;

  // Apply sequence filtering regardless of environment
  if (activeStep.sequence?.length) {
    return this.sequencer.filterToolsBySequence(activeStep, sessionId, allToolIds);
  }

  // If step has explicitly allowed tools, filter by those
  if (activeStep.availableTools?.allowed && activeStep.availableTools.allowed.length > 0) {
    return allToolIds.filter(toolId => {
      return activeStep.availableTools?.allowed?.includes(toolId) || false;
    });
  }

  // If step has explicitly denied tools, filter those out
  if (activeStep.availableTools?.denied && activeStep.availableTools.denied.length > 0) {
    return allToolIds.filter(toolId => {
      return !activeStep.availableTools?.denied?.includes(toolId);
    });
  }

  // Default - return all tools
  return allToolIds;
}
```

## Sequence Processing

When tools are used, the sequence advances accordingly:

```typescript
public processToolUsage(
  orchestration: OrchestrationConfig,
  messages: LLMMessage[],
  sessionId: SessionId,
  toolName: string
): void {
  // Get active step
  const activeStep = this.getActiveStep(orchestration, messages, sessionId);

  // Skip if no active step
  if (!activeStep) return;

  // Skip if no sequence defined
  if (!activeStep.sequence?.length) return;

  // Always process tool usage through the sequencer
  this.sequencer.processTool(activeStep, sessionId, toolName);
}
```

## User Experience

The sequence enforcement system creates a guided experience for users:

1. **Clarity**: The agent clearly communicates which tool it's using in the sequence
2. **Structure**: Complex reasoning processes follow a consistent pattern
3. **Methodical**: Steps like evaluation follow a "critique → debate → reflect" pattern
4. **Thoroughness**: Ensures agents don't skip important steps in a reasoning process

## Example: Evaluation Mode Sequence

A practical example of sequence enforcement is the Evaluation Mode in our cognitive reasoning agents:

```json
{
  "name": "EvaluationMode",
  "description": "Critical evaluation sequence",
  "conditions": [
    {
      "type": "message_regex",
      "value": "critique|evaluate|assess|review|analyze|opinion"
    }
  ],
  "sequence": ["critique", "debate", "reflect"],
  "availableTools": {
    "allowed": ["critique", "debate", "reflect", "search"]
  }
}
```

This enforces a three-step evaluation process:

1. First critically analyze the subject (critique)
2. Then present multiple perspectives (debate)
3. Finally extract insights and principles (reflect)

This structured approach ensures thorough evaluation regardless of deployment environment.

## Deployment Considerations

### Serverless/Edge

In serverless and Edge deployments:

- Sequence enforcement works consistently
- Session state must be properly rehydrated between requests
- Response headers contain minimal state information

### Long-Running Servers

In long-running server deployments:

- Full state persistence provides seamless sequence tracking
- Memory management prevents sequence state from growing unbounded
- Cleanup mechanisms prevent leaked states

## Best Practices

1. **Keep Sequences Short**: Aim for 3-5 steps maximum
2. **Provide Context**: Explain to users that a structured sequence is being followed
3. **Allow Flexibility**: When appropriate, include multiple tools in sequence positions
4. **Test Thoroughly**: Ensure sequences work properly across all deployment environments
