# Orchestrated Agent Example

This agent demonstrates the orchestration capabilities of the AgentDock framework, showing how to create agents that adapt their behavior based on context and user input.

## Key Features

- **Context-Based Behavior**: Changes behavior based on user messages
- **Tool Availability Control**: Dynamically enables/disables tools based on the current step
- **Condition-Based Activation**: Activates different modes based on message content or previous tool usage
- **Default Step Fallback**: Provides a fallback step when no specific conditions match

## Orchestration Steps

This agent includes several orchestration steps that activate in different contexts:

1. **Initial Greeting**: Default step that activates when no other conditions match
2. **Web Research Mode**: Activates when users ask for information or use search-related terms
3. **Structured Thinking Mode**: Activates when users want to analyze problems or think through solutions
4. **Reflection Mode**: Activates when users want to reflect on experiences or extract insights
5. **Brainstorming Mode**: Activates when users want to generate creative ideas
6. **Comparison Mode**: Activates when users want to compare and evaluate options
7. **Tool Follow-up Mode**: Activates after certain tools have been used

## Cognitive Tools Used

This agent leverages several cognitive tools from the AgentDock framework:

- **Think**: For structured, step-by-step analysis of complex problems
- **Reflect**: For retrospective analysis of experiences and extracting insights
- **Brainstorm**: For generating diverse ideas and creative solutions
- **Compare**: For evaluating options against specific criteria
- **Critique**: For providing balanced assessment of ideas or arguments
- **Debate**: For exploring multiple perspectives on complex topics

## Condition Types

The orchestration system supports multiple condition types:

- `message_contains`: Checks if a message contains specific text
- `message_starts_with`: Checks if a message starts with specific text
- `message_regex`: Checks if a message matches a regular expression pattern
- `tool_used`: Checks if a specific tool was recently used

## Tool Availability

Each step can specify which tools are available:

- `allowed`: List of tools explicitly allowed in this step
- `denied`: List of tools explicitly denied in this step

Tools can use wildcard patterns (e.g., `search*`) to match multiple tool IDs.

## Usage

This agent can be used as a reference for implementing your own orchestrated agents. The orchestration system allows for more controlled and context-aware agent behavior without requiring complex conditional logic in the agent's personality.

To use this agent as a template, you can:

1. Copy and modify the template.json file
2. Customize the orchestration steps, conditions, and tool availability
3. Adapt the personality and node configurations to your needs 