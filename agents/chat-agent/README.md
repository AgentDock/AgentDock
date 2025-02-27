# Chat Agent

General purpose chat assistant powered by Claude 3.

## Description

A versatile chat agent designed for natural conversation and helpful responses.

## Features

- Natural conversation capabilities
- Helpful and friendly responses
- Balanced temperature for creativity

## Nodes

The agent uses the following nodes:
- llm.anthropic: Advanced language model for chat

## Configuration

See `template.json` for the full configuration.

## Conversation Capabilities

1. General Discussion
   - Open-ended conversations
   - Topic exploration
   - Natural transitions

2. Question Answering
   - Clear explanations
   - Follow-up handling
   - Knowledge sharing

3. Personality
   - Friendly and approachable
   - Adaptable tone
   - Context-aware responses

## Usage Example

```typescript
const agent = new AgentNode('chat', config);
await agent.initialize();

const response = await agent.execute('Tell me about your capabilities.');
console.log(response);
```

## Best Practices

1. Conversation Flow
   - Allow natural topic progression
   - Use follow-up questions
   - Maintain context appropriately

2. Interaction Style
   - Be clear with questions
   - Provide context when needed
   - Use natural language

3. Settings Customization
   - Adjust temperature for desired creativity
   - Configure history length based on needs
   - Customize initial greeting for your use case 
 