# Avalanche AI Builder

Expert agent for designing and developing AI applications on Avalanche using the AgentDock framework with deep research capabilities.

## Description

This agent specializes in helping users conceptualize, design, and implement AI-powered applications for the Avalanche blockchain ecosystem using AgentDock's core architecture, with particular focus on coin-operated agents, custom tool development, and comprehensive research-backed solutions.

## Features

- AI + Avalanche blockchain integration expertise
- Coin-operated agent (COA) design guidance
- Custom tool development for Avalanche integration
- AgentDock core architecture implementation guidance
- Deep research capabilities for complex blockchain and AI topics

## Nodes

The agent uses the following nodes:
- search: Web search for up-to-date Avalanche ecosystem information
- deep-research: Comprehensive research on technical topics and implementation approaches (prioritized for complex queries)

## Configuration

See `template.json` for the full configuration. The agent is configured to prioritize deep-research for complex queries and technical topics.

## Capabilities

1. Project Ideation
   - AI agent concept development for Avalanche
   - Use case identification
   - Ecosystem fit analysis
   - AgentDock integration planning
   - Research-backed solution design

2. Technical Design
   - Architecture recommendations using AgentDock's node system
   - Custom tool implementation patterns
   - Component-based rendering approaches
   - Implementation considerations
   - Comprehensive technical research

3. Development Guidance
   - Custom tool development following AgentDock's contribution guidelines
   - Node configuration and implementation
   - Testing and validation strategies
   - Security and optimization recommendations
   - Research-driven best practices

## AgentDock Core Integration

This agent provides guidance on:

1. **Node-Based Architecture**
   - Understanding nodes as foundational building blocks
   - Tools as specialized nodes used by AI agents
   - Node configuration and connections
   - Node Registry and Tool Registry systems

2. **Custom Tool Development**
   - Implementing tools in the `src/nodes/` directory
   - Following the Vercel AI SDK pattern
   - Parameter schema definition with zod
   - Component-based output formatting
   - Clear separation between logic and presentation

3. **Component-Based Rendering**
   - Creating components that format tool output
   - Using shared markdown utilities
   - Consistent formatting across tools
   - UI rendering across different platforms

4. **API Integration**
   - Server-side API calls to Avalanche endpoints
   - Environment variables for API keys
   - Error handling and rate limiting
   - BYOK (Bring Your Own Key) support

5. **AgentDock Core Architecture**
   - Hybrid architecture combining simplicity and extensibility
   - Request flow from user input to response
   - LLM integration with multiple providers
   - Storage system with pluggable interfaces and vector capabilities
   - Configurable determinism for agent behavior

## Usage Example

```typescript
const agent = new AgentNode('avalanche-builder', config);
await agent.initialize();

const response = await agent.execute('Help me design a coin-operated agent for automated liquidity management on Avalanche using AgentDock.');
console.log(response);
```

## Best Practices

1. Project Development
   - Clearly define the AI capabilities needed
   - Consider Avalanche-specific features and limitations
   - Focus on practical implementation paths
   - Design for real-world use cases
   - Leverage deep research for complex problems

2. Technical Implementation
   - Follow AgentDock's custom tool contribution guidelines
   - Implement proper error handling
   - Use component-based rendering for consistent output
   - Design with security and scalability in mind
   - Understand AgentDock's core architecture principles

3. Agent Design
   - Define clear agent objectives and constraints
   - Configure appropriate nodes for required capabilities
   - Structure agent templates with appropriate personality traits
   - Document implementation following best practices
   - Utilize deep research for comprehensive solutions 