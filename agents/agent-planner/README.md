# AI Agent Planner

Specialized agent for designing and implementing AI agents using the AgentDock framework and RFA system.

## Description

The AI Agent Planner is an expert system designed to help users conceptualize, design, and implement AI agents within the AgentDock framework. This agent has deep knowledge of the Request For Agents (RFA) system and can guide users through the entire process of creating effective AI agents that solve real-world problems.

## Features

- **Agent Ideation**: Generate creative AI agent concepts based on user needs
- **Architecture Design**: Create effective node-based architectures for agents
- **Implementation Guidance**: Provide detailed implementation instructions
- **RFA System Integration**: Generate agent specifications following the RFA format
- **Best Practices**: Recommend optimal approaches for agent development
- **Deep Research**: Utilize comprehensive research for agent design decisions
- **Custom Tool Development**: Guide users in creating and contributing custom tools

## Nodes

The agent uses the following nodes:

- **llm.anthropic**: Advanced language model for agent design and planning
- **search**: Web search capabilities for reference information
- **deep_research**: In-depth research capabilities for comprehensive analysis

## Agent Planning Process

### 1. Requirement Analysis

- Understand user needs and objectives
- Identify key capabilities required
- Define success criteria for the agent

### 2. Agent Conceptualization

- Generate creative agent ideas
- Research similar implementations
- Evaluate feasibility and effectiveness

### 3. Architecture Design

- Select appropriate nodes for required capabilities
- Design node connections and data flow
- Optimize for performance and reliability

### 4. Implementation Planning

- Create detailed implementation steps
- Provide code examples for node configuration
- Recommend testing approaches

### 5. RFA Documentation

- Generate comprehensive RFA documentation
- Include problem statement and solution architecture
- Provide implementation guidance and examples

## Usage Examples

### Designing a New Agent

```
User: I need an agent that can help me analyze financial data and provide investment recommendations.

Agent Planner: [Provides detailed agent design with appropriate nodes, connections, and implementation guidance]
```

### Implementing an RFA

```
User: How would I implement the Code Reviewer Agent from RFA-001?

Agent Planner: [Provides step-by-step implementation guidance based on the RFA specification]
```

### Generating Agent Ideas

```
User: What are some useful AI agents I could create for my e-commerce business?

Agent Planner: [Generates creative agent ideas with implementation approaches]
```

### Creating a Custom Tool

```
User: How do I create a custom tool for AgentDock that fetches weather data?

Agent Planner: [Provides detailed guidance on implementing a custom weather tool following AgentDock's contribution guidelines]
```

## Deep Research Capabilities

The AI Agent Planner is an expert at using the deep_research tool for comprehensive agent planning:

### Research Parameters

- **Depth**: Controls how many levels of follow-up searches to perform (1-3)
- **Breadth**: Determines how many search results to consider per level (1-5)

### Optimal Research Strategies

- **Depth 1, Breadth 3**: Quick overview of a topic (faster)
- **Depth 2, Breadth 3**: Balanced research for most agent planning needs
- **Depth 3, Breadth 5**: Comprehensive research for complex agent designs (slower)

### Research Applications

- Exploring new agent concepts
- Understanding complex domains
- Investigating implementation approaches
- Analyzing open source projects
- Evaluating technical feasibility

## RFA Implementation Expertise

The agent provides comprehensive guidance on implementing agents using the RFA system:

### RFA Implementation Process

1. **Understanding the RFA**: Analyzing problem statements and solution architectures
2. **Setting Up Agent Templates**: Creating the necessary files and directory structure
3. **Configuring the Agent**: Setting up personality traits, nodes, and chat settings
4. **Implementing Required Nodes**: Creating custom nodes as specified in the RFA
5. **Testing the Implementation**: Validating against RFA requirements
6. **Documentation**: Creating comprehensive agent documentation

### Template Configuration

The agent can help create properly structured template.json files with:

- Appropriate personality traits
- Required nodes and configurations
- Effective chat settings and prompts

### Node Implementation

The agent provides guidance on implementing custom nodes with:

- Parameter schemas using Zod
- Execute functions with proper error handling
- UI components for result formatting

## Custom Tool Development

The agent offers expert guidance on creating and contributing custom tools to the AgentDock framework:

### Understanding the Architecture

- **Nodes vs. Tools**: Nodes are the foundational building blocks, while tools are specialized nodes used by AI agents
- **Simplified Architecture**: Custom tools are implemented exclusively within the `src/nodes/` directory
- **Vercel AI SDK Pattern**: All tools follow the Vercel AI SDK pattern for consistency

### Contribution Process

1. **Fork** the repository on GitHub
2. **Create a new branch** in your fork
3. **Create a new folder** within `src/nodes/` for your custom tool
4. **Add implementation files**:
   - `index.ts` - Main tool implementation and exports
   - `components.ts` - UI components and rendering logic
   - `README.md` - Tool documentation
5. **Submit a pull request** to the main branch

### Tool Implementation Pattern

```typescript
// index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { MyComponent } from './components';

// 1. Define parameters schema
const myToolSchema = z.object({
  input: z.string().describe('What this input does'),
});

// 2. Create and export your tool
export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: myToolSchema,
  async execute({ input }) {
    // 3. Get your data
    const data = await fetchData(input);

    // 4. Use your component to format output
    return MyComponent(data);
  },
};

// 5. Export for auto-registration
export const tools = {
  my_tool: myTool,
};
```

### Component-Based Architecture

- Each tool must have components that format its output
- Components use shared markdown utilities for consistent formatting
- The `createToolResult` function is used to create standardized tool results

### API Access and Security

- API calls should always be made server-side in the tool's execute function
- API keys should be stored in environment variables, never hardcoded
- API access logic should be encapsulated in utility functions
- Proper error handling should be implemented for API failures

### Best Practices

- **Keep It Simple**: One tool per directory with clear parameter schemas
- **Type Safety**: Use Zod for parameters and define clear interfaces
- **Error Handling**: Format errors as markdown with helpful messages
- **Testing**: Test components independently and mock API responses

## Best Practices

### 1. Requirement Clarity

- Be specific about what you want your agent to accomplish
- Provide examples of expected inputs and outputs
- Describe the problem you're trying to solve

### 2. Architecture Design

- Start with a simple architecture and iterate
- Consider scalability and maintainability
- Leverage existing nodes when possible

### 3. Implementation

- Follow the RFA format for structured implementation
- Test each node individually before connecting
- Document your agent thoroughly

## Advanced Features

### Architecture Visualization

The agent can create mermaid diagrams to visualize:

- Node connections and data flow
- Component relationships
- Process workflows

### Code Generation

The agent provides example code for:

- Agent template configuration
- Custom node implementation
- Component creation
- Utility functions

### Testing Strategies

The agent recommends approaches for:

- Validating agent functionality
- Testing edge cases
- Ensuring reliability
- Optimizing performance
