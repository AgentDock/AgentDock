/**
 * @fileoverview Example usage of the ThinVercelAIAdapter
 */

import { ThinVercelAIAdapter } from '../thin-vercel-ai-adapter';
import { v4 as uuidv4 } from 'uuid';
import { Message, UserMessage, SystemMessage } from '../../../types/messages';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Example of using the ThinVercelAIAdapter for non-streaming completions
 */
async function basicCompletionExample() {
  console.log('=== Basic Completion Example ===');
  
  // Create a new adapter instance
  const adapter = new ThinVercelAIAdapter({
    model: process.env.DEFAULT_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000'),
    apiKey: process.env.OPENAI_API_KEY,
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
      content: 'Hello, how are you?',
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
 * Example of using the ThinVercelAIAdapter for streaming completions
 */
async function streamingCompletionExample() {
  console.log('=== Streaming Completion Example ===');
  
  // Create a new adapter instance
  const adapter = new ThinVercelAIAdapter({
    model: process.env.DEFAULT_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000'),
    apiKey: process.env.OPENAI_API_KEY,
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
      content: 'Write a short poem about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  try {
    // Generate a streaming completion
    const stream = await adapter.generateCompletionStream(messages);
    
    // Process the stream
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let done = false;
    
    console.log('Assistant:');
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        const text = decoder.decode(value);
        process.stdout.write(text);
      }
    }
    
    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example of using the ThinVercelAIAdapter with multipart messages
 */
async function multipartMessageExample() {
  console.log('=== Multipart Message Example ===');
  
  // Create a new adapter instance
  const adapter = new ThinVercelAIAdapter({
    model: 'gpt-4-vision-preview',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000'),
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create a multipart message with text and image
  const messages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant that can analyze images.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What can you tell me about this image?'
        },
        {
          type: 'image',
          url: 'https://example.com/image.jpg',
          alt: 'Example image'
        }
      ],
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
 * Run the examples based on command-line arguments
 */
async function runExamples() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('basic')) {
    await basicCompletionExample();
  }
  
  if (args.length === 0 || args.includes('streaming')) {
    console.log('\n');
    await streamingCompletionExample();
  }
  
  if (args.length === 0 || args.includes('multipart')) {
    console.log('\n');
    await multipartMessageExample();
  }
}

// Check if this file is being run directly
if (require.main === module) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('Please set it in your .env file or environment variables.');
    process.exit(1);
  }
  
  runExamples().catch(error => {
    console.error('Error running examples:', error);
    process.exit(1);
  });
} 