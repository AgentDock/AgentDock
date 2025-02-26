/**
 * @fileoverview Standalone test for the ThinVercelAIAdapter concept
 * This file doesn't rely on imports from the parent project
 */

import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define message types
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface BaseMessage {
  id: string;
  role: MessageRole;
  content: string | any[];
  createdAt: Date;
}

interface SystemMessage extends BaseMessage {
  role: 'system';
  content: string;
}

interface UserMessage extends BaseMessage {
  role: 'user';
}

interface AssistantMessage extends BaseMessage {
  role: 'assistant';
}

// Simple adapter implementation
class SimpleAdapter {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 1000;
  }

  // Convert our messages to OpenAI format
  private toOpenAIMessages(messages: BaseMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Generate a completion
  async generateCompletion(messages: BaseMessage[]): Promise<any> {
    const openaiMessages = this.toOpenAIMessages(messages);

    const body = {
      model: this.model,
      messages: openaiMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}

// Test function
async function runTest() {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('Please set it in your .env file or environment variables.');
    process.exit(1);
  }

  // Create adapter
  const adapter = new SimpleAdapter({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000')
  });

  // Create messages
  const messages: BaseMessage[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant.',
      createdAt: new Date()
    } as SystemMessage,
    {
      id: uuidv4(),
      role: 'user',
      content: 'Write a short haiku about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  console.log('Sending request to OpenAI API...');
  console.log('Messages:', JSON.stringify(messages, null, 2));

  try {
    // Generate completion
    const result = await adapter.generateCompletion(messages);
    
    console.log('\nResponse from OpenAI API:');
    console.log('Assistant:', result.choices[0].message.content);
    console.log('Usage:', result.usage);
  } catch (error) {
    console.error('Error generating completion:', error);
  }
}

// Run the test
runTest().catch(console.error); 