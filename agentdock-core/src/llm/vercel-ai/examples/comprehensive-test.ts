/**
 * @fileoverview Comprehensive test for the ThinVercelAIAdapter concept
 * This file demonstrates the key features of the adapter
 */

import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

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

interface ToolMessage extends BaseMessage {
  role: 'tool';
  toolName: string;
  toolCallId: string;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  url: string;
  alt?: string;
}

interface ToolCallContent {
  type: 'tool_call';
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
}

interface ToolResultContent {
  type: 'tool_result';
  toolCallId: string;
  result: any;
}

// Simple adapter implementation
class SimpleAdapter {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    headers?: Record<string, string>;
  }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 1000;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1/chat/completions';
    this.headers = options.headers || {};
  }

  // Convert our messages to OpenAI format
  private toOpenAIMessages(messages: BaseMessage[]): any[] {
    return messages.map(msg => {
      // Handle different message types
      if (msg.role === 'system' || typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content
        };
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        // Handle multipart content
        if (Array.isArray(msg.content)) {
          const content = msg.content.map(part => {
            if (part.type === 'text') {
              return {
                type: 'text',
                text: (part as TextContent).text
              };
            } else if (part.type === 'image') {
              return {
                type: 'image_url',
                image_url: {
                  url: (part as ImageContent).url
                }
              };
            } else if (part.type === 'tool_call') {
              const toolCall = part as ToolCallContent;
              return {
                type: 'tool_call',
                tool_call_id: toolCall.toolCallId,
                name: toolCall.toolName,
                args: toolCall.args
              };
            }
            return part;
          });
          
          return {
            role: msg.role,
            content
          };
        } else {
          return {
            role: msg.role,
            content: msg.content
          };
        }
      } else if (msg.role === 'tool') {
        const toolMsg = msg as ToolMessage;
        const content = Array.isArray(toolMsg.content) 
          ? (toolMsg.content[0] as ToolResultContent).result 
          : toolMsg.content;
          
        return {
          role: 'tool',
          tool_call_id: toolMsg.toolCallId,
          content: JSON.stringify(content)
        };
      }
      
      return {
        role: msg.role,
        content: msg.content
      };
    });
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
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...this.headers
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
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

  // Generate a streaming completion
  async generateCompletionStream(messages: BaseMessage[]): Promise<ReadableStream<Uint8Array>> {
    const openaiMessages = this.toOpenAIMessages(messages);

    const body = {
      model: this.model,
      messages: openaiMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...this.headers
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData}`);
      }

      return response.body as ReadableStream<Uint8Array>;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt the user for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Test basic completion
async function testBasicCompletion(adapter: SimpleAdapter) {
  console.log('\n=== Testing Basic Completion ===');
  
  const userPrompt = await prompt('Enter your message (or press Enter for default): ');
  
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
      content: userPrompt || 'Write a short haiku about programming.',
      createdAt: new Date()
    } as UserMessage
  ];

  console.log('\nSending request to API...');
  
  try {
    const result = await adapter.generateCompletion(messages);
    
    console.log('\nResponse from API:');
    console.log('Assistant:', result.choices[0].message.content);
    console.log('Usage:', result.usage);
    
    return result.choices[0].message;
  } catch (error) {
    console.error('Error generating completion:', error);
    return null;
  }
}

// Test streaming completion
async function testStreamingCompletion(adapter: SimpleAdapter) {
  console.log('\n=== Testing Streaming Completion ===');
  
  const userPrompt = await prompt('Enter your message (or press Enter for default): ');
  
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
      content: userPrompt || 'Write a short story about a programmer who discovers AI.',
      createdAt: new Date()
    } as UserMessage
  ];

  console.log('\nSending request to API...');
  console.log('Response (streaming):');
  
  try {
    const stream = await adapter.generateCompletionStream(messages);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let fullText = '';
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        const text = decoder.decode(value);
        process.stdout.write(text);
        fullText += text;
      }
    }
    
    console.log('\n');
    return { role: 'assistant', content: fullText };
  } catch (error) {
    console.error('Error generating streaming completion:', error);
    return null;
  }
}

// Test multipart messages
async function testMultipartMessages(adapter: SimpleAdapter) {
  console.log('\n=== Testing Multipart Messages ===');
  console.log('Note: This requires a vision-capable model like gpt-4-vision-preview');
  
  const imageUrl = await prompt('Enter an image URL (or press Enter for default): ');
  const defaultImageUrl = 'https://images.unsplash.com/photo-1526378800651-c32d170fe6f8?q=80&w=1000';
  
  const messages: BaseMessage[] = [
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
        } as TextContent,
        {
          type: 'image',
          url: imageUrl || defaultImageUrl,
          alt: 'An image to analyze'
        } as ImageContent
      ],
      createdAt: new Date()
    } as UserMessage
  ];

  console.log('\nSending request to API...');
  
  try {
    const result = await adapter.generateCompletion(messages);
    
    console.log('\nResponse from API:');
    console.log('Assistant:', result.choices[0].message.content);
    console.log('Usage:', result.usage);
    
    return result.choices[0].message;
  } catch (error) {
    console.error('Error generating completion with multipart message:', error);
    return null;
  }
}

// Test conversation with history
async function testConversationWithHistory(adapter: SimpleAdapter) {
  console.log('\n=== Testing Conversation with History ===');
  
  const messages: BaseMessage[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant.',
      createdAt: new Date()
    } as SystemMessage
  ];
  
  let conversationActive = true;
  
  while (conversationActive) {
    const userInput = await prompt('\nEnter your message (or type "exit" to end): ');
    
    if (userInput.toLowerCase() === 'exit') {
      conversationActive = false;
      continue;
    }
    
    // Add user message to conversation
    messages.push({
      id: uuidv4(),
      role: 'user',
      content: userInput,
      createdAt: new Date()
    } as UserMessage);
    
    console.log('\nSending request to API...');
    
    try {
      const result = await adapter.generateCompletion(messages);
      
      console.log('\nAssistant:', result.choices[0].message.content);
      
      // Add assistant response to conversation history
      messages.push({
        id: uuidv4(),
        role: 'assistant',
        content: result.choices[0].message.content,
        createdAt: new Date()
      } as AssistantMessage);
    } catch (error) {
      console.error('Error in conversation:', error);
    }
  }
}

// Main test function
async function runTests() {
  console.log('=== ThinVercelAIAdapter Concept Testing ===');
  
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
  
  // Display test menu
  while (true) {
    console.log('\n=== Test Menu ===');
    console.log('1. Basic Completion');
    console.log('2. Streaming Completion');
    console.log('3. Multipart Messages (Vision)');
    console.log('4. Conversation with History');
    console.log('5. Exit');
    
    const choice = await prompt('\nSelect a test (1-5): ');
    
    switch (choice) {
      case '1':
        await testBasicCompletion(adapter);
        break;
      case '2':
        await testStreamingCompletion(adapter);
        break;
      case '3':
        // Create a vision-capable adapter
        const visionAdapter = new SimpleAdapter({
          apiKey: process.env.OPENAI_API_KEY,
          model: 'gpt-4-vision-preview',
          temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '1000')
        });
        await testMultipartMessages(visionAdapter);
        break;
      case '4':
        await testConversationWithHistory(adapter);
        break;
      case '5':
        console.log('Exiting...');
        rl.close();
        return;
      default:
        console.log('Invalid choice. Please select a number between 1 and 5.');
    }
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  rl.close();
  process.exit(1);
}); 