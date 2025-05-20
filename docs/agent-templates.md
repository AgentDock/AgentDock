# Agent Templates

Agent Templates are the core configuration mechanism in AgentDock, allowing you to define an agent's identity, capabilities, and behavior in a declarative JSON format.

## Overview

Each agent in the `/agents` directory has a `template.json` file. This file defines:

- Basic identity (ID, name, description)
- LLM provider and model selection, including model parameters
- System prompt and personality traits
- Available tools
- Orchestration rules (steps, conditions, sequences)

This templating system makes it easy to create, share, and modify agents without writing extensive code.

See [Contributing Community Agents](./rfa/add-agent.md) for information on how to add your own agent templates to the public repository.

## Template Structure (`template.json`)

The `template.json` file follows this general structure:

```json
{
  "version": "1.0", // Optional: Version of the template format
  "agentId": "unique-agent-id", // Required: Unique identifier
  "name": "Display Name", // Required: Name shown in UI
  "description": "Brief description of the agent.", // Required: Description for UI
  "tags": ["Example", "Research"], // Optional: Tags for categorization
  "priority": 10, // Optional: Lower numbers appear higher in lists
  "personality": [
    // Required: System prompt broken into lines/paragraphs
    "Personality trait 1",
    "Personality trait 2"
  ],
  "nodes": [
    // Required: List of node types used by the agent
    "llm.openai", // Example: Specify the LLM node provider
    "search" // Example: Include necessary tool nodes
  ],
  "nodeConfigurations": {
    // Required: Configuration for specific nodes
    "llm.openai": {
      // Key matches the node type from the "nodes" list
      "model": "YOUR_CHOSEN_MODEL", // Required: Specify the model ID
      "temperature": 0.7, // Optional: Controls randomness (0=deterministic, >0=more random). Range varies by provider.
      "maxTokens": 4096, // Optional: Max tokens for the response.
      "topP": 0.9, // Optional: Nucleus sampling (0-1). Consider only top P% probability mass. Use temperature OR topP.
      "topK": 50, // Optional: Consider only the top K most likely tokens.
      "frequencyPenalty": 0.2, // Optional: Penalizes frequently used tokens (0=no penalty). Range varies.
      "presencePenalty": 0.1, // Optional: Penalizes tokens already present in prompt/response (0=no penalty). Range varies.
      "stopSequences": ["\nUser:"], // Optional: Sequences that stop generation.
      "seed": 12345, // Optional: Integer for deterministic results (if supported).
      "useCustomApiKey": false // Optional: If true, requires user to provide API key in settings.
    },
    "search": {
      // Example: Configuration for a tool node (if needed)
      "maxResults": 5
    }
  },
  "chatSettings": {
    // Required: Settings for the chat interface
    "historyPolicy": "lastN", // Optional: 'none', 'lastN', 'all' (default: 'lastN')
    "historyLength": 20, // Optional: Number of messages if policy is 'lastN' (default: 50)
    "initialMessages": [
      // Optional: Messages shown when chat starts
      "Hello! How can I help?"
    ],
    "chatPrompts": [
      // Optional: Suggested prompts shown in UI
      "What can you do?"
    ]
  },
  "options": {
    // Optional: Additional agent-level options
    "maxSteps": 10 // Example: Max tool execution steps per turn
  }
}
```

### Key Configuration Fields

- **`agentId`, `name`, `description`**: Basic identification.
- **`personality`**: Defines the system prompt and core behavior. Crucial for guiding the LLM.
- **`nodes`**: Lists all capabilities (LLM provider node, tool nodes) the agent requires.
- **`nodeConfigurations`**: Allows setting specific parameters for each node listed in `nodes`.
  - For LLM nodes (e.g., `llm.openai`), you **must** specify the `model`.
  - You can optionally override default LLM behavior by setting parameters like `temperature`, `maxTokens`, `topP`, `topK`, `frequencyPenalty`, `presencePenalty`, `stopSequences`, and `seed`. The exact behavior and valid ranges for these settings can vary between different LLM providers.
- **`chatSettings`**: Controls the user interface behavior, initial state, and prompt suggestions.

For detailed explanations of the common LLM settings (`temperature`, `topP`, `maxTokens`, etc.) and their effects, refer to the [Vercel AI SDK Settings Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/settings).

## Featured Agents

| Agent                                                   | Description                                                                                                                                                                                                                                                             | GitHub                                                                                  |
| :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| [Cognitive Reasoner](/chat?agent=cognitive-reasoner)    | Tackles complex problems using a suite of cognitive enhancement tools and structured reasoning. Features different operational modes including Research, Problem-Solving, Evaluation, Comparison, Ideation, and Debate. Uses the think tool for step-by-step reasoning. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/cognitive-reasoner) |
| [Dr. House](/chat?agent=dr-house)                       | Medical diagnostician inspired by the TV character, specializing in advanced medical diagnostics and rare disease identification. Leverages comprehensive medical knowledge and medical databases.                                                                      | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/dr-house)           |
| [Science Translator](/chat?agent=science-translator)    | Makes complex scientific papers accessible by finding and translating them into simple language without sacrificing accuracy. Utilizes PubMed access and multi-database scientific research capabilities.                                                               | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/science-translator) |
| [Calorie Vision](/chat?agent=calorie-vision)            | Analyzes food images to provide precise calorie and nutrient breakdowns using visual recognition technology. Integrates with visual analysis tools to process and evaluate food content from photos.                                                                    | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/calorie-vision)     |
| [Harvey Specter](/chat?agent=harvey-specter)            | Legal strategist and negotiator inspired by the Suits character, specializing in contract review, case strategy, and negotiation tactics. Accesses legal databases to provide accurate and actionable legal insights.                                                   | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/harvey-specter)     |
| [Orchestrated Agent](/chat?agent=orchestrated-agent)    | Demonstrates advanced agent orchestration by combining multiple specialized agents and tools in a cohesive workflow with dynamic branching. Shows how different agents can be combined and orchestrated.                                                                | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/orchestrated-agent) |
| [Agent Planner](/chat?agent=agent-planner)              | Specialized agent for designing and implementing AI agents using the AgentDock framework and RFA system. Provides agent ideation, architecture design, implementation guidance, and RFA system integration.                                                             | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/agent-planner)      |
| [Tenant Rights Advisor](/chat?agent=tenant-rights)      | Guides renters through housing issues like repairs, evictions, and deposit disputes based on general housing regulations.                                                                                                                                               | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/tenant-rights)      |
| [Consumer Rights Defender](/chat?agent=consumer-rights) | Helps consumers navigate issues with refunds, warranties, defective products, and unfair billing practices.                                                                                                                                                             | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/consumer-rights)    |
| [Small Claims Court Guide](/chat?agent=small-claims)    | Assists with small claims court navigation including filing paperwork, preparing evidence, and collecting judgments.                                                                                                                                                    | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/small-claims)       |

## Agent File Structure

For detailed implementation examples, clone the AgentDock repository and explore the `agents/` directory.

```
agents/
└── agent-name/
    ├── template.json     # Core configuration (required)
    ├── README.md         # Documentation (recommended)
    └── assets/           # Optional assets (e.g., avatar.png)
```

## Usage

These templates can be:

1.  **Tested directly**: Try them out via the chat interface by clicking the agent links above (if running the client).
2.  **Examined for patterns**: Study their implementations to learn configuration techniques.
3.  **Used as starting points**: Copy and modify them to create your own specialized agents.
