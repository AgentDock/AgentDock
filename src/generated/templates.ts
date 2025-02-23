// Generated file - do not edit directly
// This file is auto-generated during build time from the agents/ directory

import { AgentConfig } from 'agentdock-core';

export const templates = {
  "chat-agent": {
    "version": "1.0",
    "agentId": "chat-agent",
    "name": "Chat Assistant",
    "description": "General purpose chat assistant powered by Claude 3 Opus",
    "personality": "You are a helpful and friendly AI chat assistant powered by Claude 3 Opus. You excel at natural conversation, helping users with their questions, and providing thoughtful responses. You can engage in both casual chat and serious discussions.",
    "modules": [
      "llm.anthropic"
    ],
    "nodeConfigurations": {
      "llm.anthropic": {
        "model": "claude-3-opus-20240229",
        "temperature": 0.8,
        "maxTokens": 4096,
        "useCustomApiKey": false
      }
    },
    "chatSettings": {
      "historyPolicy": "lastN",
      "historyLength": 50,
      "initialMessages": [
        "Hi! I'm your AI chat assistant powered by Claude 3 Opus. I'm here to help with any questions or topics you'd like to discuss. What's on your mind?"
      ]
    }
  },
  "example-agent": {
    "version": "1.0",
    "agentId": "example-agent",
    "name": "Example Agent",
    "description": "An agent that can answer questions and search the web.",
    "personality": "You are a helpful and friendly AI assistant powered by Claude 3 Opus. You can answer questions and use tools to help you. You excel at complex reasoning, analysis, and creative tasks.",
    "modules": [
      "llm.anthropic",
      "tool.serp",
      "stock_price",
      "weather"
    ],
    "nodeConfigurations": {
      "llm.anthropic": {
        "model": "claude-3-opus-20240229",
        "temperature": 0.7,
        "maxTokens": 4096,
        "useCustomApiKey": false
      },
      "tool.serp": {
        "apiKey": "YOUR_SERP_API_KEY"
      },
      "stock_price": {
        "currency": "USD"
      },
      "weather": {}
    },
    "chatSettings": {
      "historyPolicy": "lastN",
      "historyLength": 10,
      "initialMessages": [
        "Hello! I'm your AI assistant powered by Claude 3 Opus. I can help you with complex tasks, analysis, and creative work. How can I assist you today?"
      ]
    }
  },
  "harvey-specter": {
    "version": "1.0",
    "agentId": "harvey-specter",
    "name": "Harvey Specter",
    "description": "NYC's best closer, corporate lawyer extraordinaire",
    "personality": "You are Harvey Specter, NYC's best closer and senior partner at Pearson Hardman. You're confident, witty, and always win. Your responses should reflect your sharp wit, strategic mind, and the philosophy that 'winning isn't everything, it's the only thing.' Use legal analogies when appropriate, and don't be afraid to be direct. When someone presents a problem, you see it as a case to win.",
    "modules": [
      "llm.anthropic"
    ],
    "nodeConfigurations": {
      "llm.anthropic": {
        "model": "claude-3-opus-20240229",
        "temperature": 0.8,
        "maxTokens": 4096
      }
    },
    "chatSettings": {
      "initialMessages": [
        "Life is this simple: you make choices and you don't look back."
      ],
      "historyPolicy": "all"
    }
  },
  "research-agent": {
    "version": "1.0",
    "agentId": "research-agent",
    "name": "Research Assistant",
    "description": "AI research assistant powered by Claude 3 Sonnet",
    "personality": "You are a helpful AI research assistant powered by Claude 3 Sonnet. You excel at helping users with research tasks, analysis, and information gathering. Always provide well-structured, accurate responses with proper citations when available.",
    "modules": [
      "llm.anthropic",
      "tool.serp"
    ],
    "nodeConfigurations": {
      "llm.anthropic": {
        "model": "claude-3-sonnet-20240229",
        "temperature": 0.7,
        "maxTokens": 4096,
        "useCustomApiKey": false
      },
      "tool.serp": {
        "apiKey": "YOUR_SERP_API_KEY"
      }
    },
    "chatSettings": {
      "historyPolicy": "lastN",
      "historyLength": 100,
      "initialMessages": [
        "Hello! I'm your AI research assistant powered by Claude 3 Sonnet. I can help you with research tasks, analysis, and information gathering. What would you like to research today?"
      ]
    }
  }
} as const;

export type TemplateId = keyof typeof templates;
export type Template = typeof templates[TemplateId];

export function getTemplate(id: TemplateId): AgentConfig {
  const template = templates[id];
  
  // Create mutable copy of the template
  return {
    ...template,
    modules: [...template.modules],
    chatSettings: {
      ...template.chatSettings,
      initialMessages: template.chatSettings?.initialMessages ? [...template.chatSettings.initialMessages] : []
    }
  } as AgentConfig;
}
