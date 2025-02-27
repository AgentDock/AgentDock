# Example Agent

This is an example agent that demonstrates the core capabilities of the AgentDock framework. It showcases various tools and configurations that can be used to create powerful AI agents.

## Features

- Powered by Claude 3 Opus for advanced reasoning
- Web search capability via SERP API
- Stock price lookup functionality
- Configurable chat history management

## Configuration

The agent uses the following modules:
- `llm.anthropic`: Claude 3 Opus model for text generation
- `core.prompt`: Custom prompt template for consistent responses
- `core.tool.serp`: Web search capability
- `tool.stock.price`: Stock price lookup tool

### Model Settings
- Model: claude-3-opus-20240229
- Temperature: 0.7 (balanced creativity and consistency)
- Max Tokens: 4096 (suitable for most conversations)

### Chat Settings
- History Policy: lastN (keeps recent messages)
- History Length: 10 messages
- Custom initial greeting

## Tools

### SERP Tool
- Requires provider and API key configuration
- Used for web searches and information gathering

### Stock Price Tool
- Currency: USD
- Provides mock stock price data
- For demonstration purposes only

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
 