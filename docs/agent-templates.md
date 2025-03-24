# Agent Templates

Agent Templates are the core configuration mechanism in AgentDock, allowing you to define an agent's identity, capabilities, and behavior in a declarative JSON format.

## Overview

Each agent in the `/agents` directory has a `template.json` file. This file defines:

*   Basic identity (ID, name, description)
*   LLM provider and model selection
*   System prompt and personality traits
*   Available tools
*   Orchestration rules (steps, conditions, sequences)

This templating system makes it easy to create, share, and modify agents without writing extensive code.

See [Contributing Community Agents](./rfa/add-agent.md) for information on how to add your own agent templates to the public repository.

## Template Structure (`template.json`)

```json
{
  "id": "unique-agent-id",
  "name": "Display Name",
  "description": "Brief description of the agent.",
  "systemPrompt": "Core instructions for the LLM.",
  "personality": [
    "Personality trait 1",
    "Personality trait 2"
  ],
  "avatar": "/avatars/optional-avatar.png",
  "provider": "openai", // or anthropic, gemini, groq, etc.
  "model": "gpt-4-turbo", // Specific model ID
  "tools": [
    "tool-id-1", 
    "tool-id-2"
  ],
  "tags": ["Example", "Research"],
  "orchestration": {
    // Orchestration configuration (optional)
    "defaultStep": "idle",
    "steps": [
      // ... step definitions ...
    ]
  }
}
```

## Featured Agents

| Agent | Description | GitHub |
|-------|-------------|--------|
| [Cognitive Reasoner](/chat?agent=cognitive-reasoner) | Tackles complex problems using a suite of cognitive enhancement tools and structured reasoning. Features different operational modes including Research, Problem-Solving, Evaluation, Comparison, Ideation, and Debate. Provides logical problem-solving, mathematical reasoning, multi-perspective analysis, nuanced debate techniques, and structured ideation approaches to complex challenges. Uses the think tool for step-by-step reasoning. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/cognitive-reasoner) |
| [Dr. House](/chat?agent=dr-house) | Medical diagnostician inspired by the TV character, specializing in advanced medical diagnostics and rare disease identification. Leverages comprehensive medical knowledge, diagnostic reasoning, medical research integration, and contextual awareness to solve complex medical cases. Has access to medical databases and clinical resources for accurate diagnoses. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/dr-house) |
| [Science Translator](/chat?agent=science-translator) | Makes complex scientific papers accessible by finding and translating them into simple language without sacrificing accuracy. Utilizes PubMed access to search and retrieve scientific literature, providing multi-database scientific research capabilities. Delivers jargon-free and audience-adaptive explanations with comprehensive research synthesis for different knowledge levels. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/science-translator) |
| [Calorie Vision](/chat?agent=calorie-vision) | Analyzes food images to provide precise calorie and nutrient breakdowns using visual recognition technology. Features advanced food identification from images, precise calorie calculation, comprehensive nutrient analysis, and nutritional improvement suggestions. Integrates with visual analysis tools to process and evaluate food content from photos. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/calorie-vision) |
| [Harvey Specter](/chat?agent=harvey-specter) | Legal strategist and negotiator inspired by the Suits character, specializing in contract review, case strategy, and negotiation tactics. Provides detailed contract analysis, legal precedent research, negotiation strategy, risk assessment, and case plan development. Accesses legal databases to provide accurate and actionable legal insights. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/harvey-specter) |
| [Orchestrated Agent](/chat?agent=orchestrated-agent) | Demonstrates advanced agent orchestration by combining multiple specialized agents and tools in a cohesive workflow with dynamic branching. Features multi-agent coordination, contextual routing, decision-based branching, parallel processing, and failure recovery mechanisms. Shows how different agents can be combined and orchestrated to solve complex problems efficiently. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/orchestrated-agent) |
| [Agent Planner](/chat?agent=agent-planner) | Specialized agent for designing and implementing AI agents using the AgentDock framework and RFA system. Provides agent ideation, architecture design, implementation guidance, RFA system integration, best practices, deep research, and custom tool development assistance. Uses search and think tools to provide comprehensive planning services for agent development. | [View Code](https://github.com/agentdock/agentdock/tree/main/agents/agent-planner) |

## Agent Structure

For detailed implementation examples, clone the AgentDock repository and explore the agents directory. 
```
agents/agent-name/
├── template.json     # Core configuration (required)
├── README.md         # Documentation (recommended)
└── assets/           # Optional assets for the agent
```

## Template Configuration

The `template.json` file defines the agent's core capabilities:

```json
{
  "version": "1.0",
  "agentId": "example-agent",
  "name": "Example Agent",
  "description": "A description of what this agent does",
  "personality": [
    "You are a helpful AI assistant.",
    "You provide clear, concise responses."
  ],
  "nodes": [
    "llm.anthropic",
    "search",
    "deep_research"
  ],
  "nodeConfigurations": {
    "llm.anthropic": {
      "model": "claude-3-5-sonnet-20240620",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  },
  "chatSettings": {
    "historyPolicy": "lastN",
    "historyLength": 20,
    "initialMessages": [
      "Hello! I'm an example agent. How can I help you today?"
    ]
  }
}
```

## Usage

These templates can be:

1. **Tested directly**: Try them out via the chat interface by clicking the agent links above
2. **Examined for patterns**: Study their implementations to learn orchestration techniques
3. **Used as starting points**: Build on top of them to create your own specialized agents 