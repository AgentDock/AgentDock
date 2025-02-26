/**
 * @fileoverview Example of using the ThinVercelAIAdapter with custom API configurations
 */

import { ThinVercelAIAdapter } from '../thin-vercel-ai-adapter';
import { v4 as uuidv4 } from 'uuid';
import { Message, UserMessage, SystemMessage } from '../../../types/messages';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Example of using the ThinVercelAIAdapter with OpenAI
 */
async function openaiExample() {
  console.log('=== OpenAI Example ===');
  
  // Create a new adapter instance for OpenAI
  const adapter = new ThinVercelAIAdapter({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1/chat/completions',
  });

  // Create some messages
  const messages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: 'Tell me a short joke about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  try {
    // Generate a completion
    const result = await adapter.generateCompletion(messages);
    
    // Log the result
    console.log('Assistant:', result.message.content);
    console.log('Usage:', result.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example of using the ThinVercelAIAdapter with Anthropic
 */
async function anthropicExample() {
  console.log('\n=== Anthropic Example ===');
  
  // Create a new adapter instance for Anthropic
  const adapter = new ThinVercelAIAdapter({
    model: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 1000,
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseUrl: 'https://api.anthropic.com/v1/messages',
    headers: {
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });

  // Create some messages
  const messages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are Claude, a helpful AI assistant created by Anthropic.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: 'Tell me a short joke about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  try {
    // Generate a completion
    const result = await adapter.generateCompletion(messages);
    
    // Log the result
    console.log('Assistant:', result.message.content);
    console.log('Usage:', result.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example of using the ThinVercelAIAdapter with a custom API endpoint
 */
async function customApiExample() {
  console.log('\n=== Custom API Example ===');
  
  // Create a new adapter instance for a custom API
  const adapter = new ThinVercelAIAdapter({
    model: 'custom-model',
    temperature: 0.7,
    maxTokens: 1000,
    baseUrl: 'https://api.example.com/v1/chat',
    headers: {
      'Authorization': 'Bearer ' + process.env.CUSTOM_API_KEY,
      'Content-Type': 'application/json',
      'X-Custom-Header': 'custom-value',
    },
  });

  // Create some messages
  const messages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: 'Tell me a short joke about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  try {
    // Generate a completion
    const result = await adapter.generateCompletion(messages);
    
    // Log the result
    console.log('Assistant:', result.message.content);
    console.log('Usage:', result.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  // Run the OpenAI example
  if (process.env.OPENAI_API_KEY) {
    await openaiExample();
  } else {
    console.log('Skipping OpenAI example (OPENAI_API_KEY not set)');
  }
  
  // Run the Anthropic example
  if (process.env.ANTHROPIC_API_KEY) {
    await anthropicExample();
  } else {
    console.log('Skipping Anthropic example (ANTHROPIC_API_KEY not set)');
  }
  
  // Run the custom API example
  if (process.env.CUSTOM_API_KEY) {
    await customApiExample();
  } else {
    console.log('Skipping custom API example (CUSTOM_API_KEY not set)');
  }
}

// Run the examples
if (require.main === module) {
  runExamples().catch(console.error);
} 