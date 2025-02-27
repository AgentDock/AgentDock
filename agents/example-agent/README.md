# Example Agent

A basic example agent for AgentDock that demonstrates core functionality.

## Description

This agent serves as a reference implementation showing how to create and configure agents in AgentDock.

## Features

- Basic chat functionality
- Example of node configuration
- Weather and stock price capabilities

## Nodes

The agent uses the following nodes:
- llm.anthropic: Core language model
- weather: Weather information lookup
- stock_price: Stock price queries

## Configuration

See `template.json` for the full configuration.

## Usage Example

```typescript
const agent = new AgentNode('example', config);
await agent.initialize();

const response = await agent.execute('What is the current price of AAPL stock?');
console.log(response);
```

## Notes

This is a reference implementation to demonstrate AgentDock's capabilities. For production use:
1. Configure proper API keys
2. Adjust model parameters as needed
3. Customize the personality and prompt template
4. Set appropriate history retention policy 
 