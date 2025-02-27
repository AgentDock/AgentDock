/**
 * @fileoverview Tests for agent configuration schema and validation
 */

import { AgentConfigSchema, PersonalitySchema, createAgentConfig, ValidatedPersonality } from '../agent-config';
import { z } from 'zod';

describe('PersonalitySchema', () => {
  it('should accept string input', () => {
    const result = PersonalitySchema.parse('Hello, I am an AI assistant');
    expect(typeof result).toBe('string');
    expect(result).toBe('Hello, I am an AI assistant');
  });

  it('should convert array input to string with newlines', () => {
    const result = PersonalitySchema.parse([
      'Hello, I am an AI assistant',
      'I can help you with various tasks',
      'Just ask me anything'
    ]);
    expect(typeof result).toBe('string');
    expect(result).toBe('Hello, I am an AI assistant\nI can help you with various tasks\nJust ask me anything');
  });

  it('should reject invalid inputs', () => {
    expect(() => PersonalitySchema.parse(null)).toThrow();
    expect(() => PersonalitySchema.parse(undefined)).toThrow();
    expect(() => PersonalitySchema.parse(123)).toThrow();
    expect(() => PersonalitySchema.parse({})).toThrow();
  });
});

describe('AgentConfigSchema', () => {
  it('should validate a complete config with string personality', () => {
    const config = {
      version: '1.0',
      agentId: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      personality: 'I am a test agent',
      nodes: ['llm.anthropic'],
      nodeConfigurations: {
        'llm.anthropic': {
          model: 'claude-3-7-sonnet-20250219',
          temperature: 0.7
        }
      },
      chatSettings: {
        historyPolicy: 'lastN' as const,
        historyLength: 10
      }
    };

    const result = AgentConfigSchema.parse(config);
    expect(result).toBeDefined();
    expect(typeof result.personality).toBe('string');
    expect(result.personality as unknown as string).toBe('I am a test agent');
  });

  it('should validate a complete config with array personality', () => {
    const config = {
      version: '1.0',
      agentId: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      personality: ['I am a test agent', 'I can help with testing'],
      nodes: ['llm.anthropic'],
      nodeConfigurations: {
        'llm.anthropic': {
          model: 'claude-3-7-sonnet-20250219',
          temperature: 0.7
        }
      },
      chatSettings: {
        historyPolicy: 'lastN' as const,
        historyLength: 10
      }
    };

    const result = AgentConfigSchema.parse(config);
    expect(result).toBeDefined();
    expect(typeof result.personality).toBe('string');
    expect(result.personality as unknown as string).toBe('I am a test agent\nI can help with testing');
  });
});

describe('createAgentConfig', () => {
  it('should create a valid config with defaults', () => {
    const result = createAgentConfig({
      agentId: 'test-agent',
      name: 'Test Agent'
    });

    expect(result).toBeDefined();
    expect(result.agentId).toBe('test-agent');
    expect(result.name).toBe('Test Agent');
    expect(typeof result.personality).toBe('string');
  });

  it('should handle string personality', () => {
    const result = createAgentConfig({
      agentId: 'test-agent',
      name: 'Test Agent',
      personality: PersonalitySchema.parse('I am a test agent')
    });

    expect(result).toBeDefined();
    expect(typeof result.personality).toBe('string');
    expect(result.personality as unknown as string).toBe('I am a test agent');
  });

  it('should handle array personality', () => {
    const result = createAgentConfig({
      agentId: 'test-agent',
      name: 'Test Agent',
      personality: PersonalitySchema.parse(['I am a test agent', 'I can help with testing'])
    });

    expect(result).toBeDefined();
    expect(typeof result.personality).toBe('string');
    expect(result.personality as unknown as string).toBe('I am a test agent\nI can help with testing');
  });
});

describe('AgentConfig', () => {
  it('should validate a valid config', () => {
    const config = {
      version: '1.0',
      agentId: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      personality: 'Helpful test assistant',
      nodes: ['llm.anthropic'],
      nodeConfigurations: {
        'llm.anthropic': {
          model: 'claude-3-sonnet',
          temperature: 0.7
        }
      },
      chatSettings: {
        initialMessages: ['Hello!'],
        historyPolicy: 'lastN',
        historyLength: 10
      }
    };

    expect(AgentConfigSchema.safeParse(config).success).toBe(true);
  });

  // Add more test cases as needed
}); 