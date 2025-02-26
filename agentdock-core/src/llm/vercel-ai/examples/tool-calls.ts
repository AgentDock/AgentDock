/**
 * @fileoverview Example of using the ThinVercelAIAdapter with tool calls
 */

import { ThinVercelAIAdapter } from '../thin-vercel-ai-adapter';
import { v4 as uuidv4 } from 'uuid';
import { Message, UserMessage, SystemMessage, AssistantMessage, ToolMessage } from '../../../types/messages';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Example of using the ThinVercelAIAdapter with tool calls
 */
async function toolCallsExample() {
  // Create a new adapter instance
  const adapter = new ThinVercelAIAdapter({
    model: process.env.DEFAULT_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000'),
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create initial messages
  const messages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant with access to tools. When asked about the weather, use the weather tool to get the current weather.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: 'What\'s the weather like in New York today?',
      createdAt: new Date()
    } as UserMessage
  ];

  try {
    // Generate a completion that might include tool calls
    const result = await adapter.generateCompletion(messages);
    
    // Log the assistant's response
    console.log('Assistant:', result.message.content);
    
    // Check if the assistant's message contains tool calls
    const assistantMessage = result.message as AssistantMessage;
    if (Array.isArray(assistantMessage.content)) {
      const toolCalls = assistantMessage.content.filter(part => part.type === 'tool_call');
      
      if (toolCalls.length > 0) {
        console.log('\nTool calls detected:');
        
        // Process each tool call
        for (const toolCall of toolCalls) {
          console.log(`- Tool: ${toolCall.toolName}`);
          console.log(`  Args: ${JSON.stringify(toolCall.args)}`);
          
          // Simulate tool execution
          const toolResult = simulateToolExecution(toolCall.toolName, toolCall.args);
          
          // Create a tool message with the result
          const toolMessage: ToolMessage = {
            id: uuidv4(),
            role: 'tool',
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            content: [
              {
                type: 'tool_result',
                toolCallId: toolCall.toolCallId,
                result: toolResult
              }
            ],
            createdAt: new Date()
          };
          
          // Add the tool message to the conversation
          messages.push(assistantMessage);
          messages.push(toolMessage);
          
          console.log(`\nTool Response (${toolCall.toolName}):`);
          console.log(JSON.stringify(toolResult, null, 2));
        }
        
        // Generate a follow-up completion with the tool results
        console.log('\nGenerating follow-up response...');
        const followUpResult = await adapter.generateCompletion(messages);
        
        console.log('\nAssistant (with tool results):', followUpResult.message.content);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Simulates the execution of a tool
 * @param toolName The name of the tool to execute
 * @param args The arguments for the tool
 * @returns The result of the tool execution
 */
function simulateToolExecution(toolName: string, args: any): any {
  // Simulate different tools
  switch (toolName) {
    case 'weather':
      return simulateWeatherTool(args.location);
    case 'calculator':
      return simulateCalculatorTool(args.expression);
    case 'search':
      return simulateSearchTool(args.query);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Simulates a weather tool
 * @param location The location to get weather for
 * @returns Simulated weather data
 */
function simulateWeatherTool(location: string): any {
  // Simulate weather data
  const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const randomTemp = Math.floor(Math.random() * 30) + 40; // 40-70°F
  
  return {
    location,
    temperature: randomTemp,
    unit: 'fahrenheit',
    conditions: randomCondition,
    humidity: Math.floor(Math.random() * 50) + 30, // 30-80%
    timestamp: new Date().toISOString()
  };
}

/**
 * Simulates a calculator tool
 * @param expression The expression to evaluate
 * @returns The result of the calculation
 */
function simulateCalculatorTool(expression: string): any {
  try {
    // CAUTION: This is for demonstration purposes only
    // In a real application, you should use a safer method to evaluate expressions
    const result = eval(expression);
    return { expression, result };
  } catch (error) {
    return { expression, error: 'Invalid expression' };
  }
}

/**
 * Simulates a search tool
 * @param query The search query
 * @returns Simulated search results
 */
function simulateSearchTool(query: string): any {
  return {
    query,
    results: [
      { title: `Result 1 for "${query}"`, url: `https://example.com/1` },
      { title: `Result 2 for "${query}"`, url: `https://example.com/2` },
      { title: `Result 3 for "${query}"`, url: `https://example.com/3` }
    ],
    timestamp: new Date().toISOString()
  };
}

// Run the example
if (require.main === module) {
  toolCallsExample().catch(console.error);
} 