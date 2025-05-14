# Provider-Agnostic API Architecture

This document explains how AgentDock works with multiple LLM providers through a unified API layer.

## What This Means For Users

AgentDock supports a variety of LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, Groq, etc.) through a single, consistent interface. This means:

1. **Consistent Experience** - The same chat interface works across all providers
2. **Easy Provider Switching** - Change providers without changing your application code
3. **Unified Error Handling** - Clear, consistent error messages regardless of provider
4. **Simple API Key Management** - Manage all provider keys in one place

## Benefits

### For Developers

1. **Simplified Integration** - Connect to any supported provider using the same API
2. **No Provider-Specific Code** - Write code once that works with all providers
3. **Future-Proof** - New providers are added to the core library without requiring changes to your application
4. **Type Safety** - Full TypeScript support for all providers

### For End Users

1. **Provider Flexibility** - Use preferred providers without learning new interfaces
2. **Graceful Error Handling** - Receive clear, actionable error messages
3. **Consistent Model Selection** - Choose models through a standardized interface
4. **Smooth Failover** - Automatic retries and provider fallbacks when configured

## Supported Providers

AgentDock currently supports these LLM providers:

- **OpenAI** - GPT models (3.5, 4, etc.)
- **Anthropic** - Claude models
- **Google** - Gemini models
- **DeepSeek** - DeepSeek models
- **Groq** - Fast inference for various models
- **Cerebras** - LLaMA and other open source models

## Error Handling

The provider-agnostic design includes standardized error handling:

1. **Normalized Errors** - Technical provider errors are translated to user-friendly messages
2. **Clear API Key Guidance** - Specific instructions when API keys are missing or invalid
3. **Appropriate Recovery Options** - Context-aware options for resolving different error types

## How It Works

Behind the scenes, AgentDock:

1. Accepts a standard message format for all providers
2. Translates requests to provider-specific formats
3. Manages streaming connections appropriately for each provider
4. Normalizes responses and errors back to a standard format

This abstraction layer means that applications using AgentDock don't need to know the details of each provider's API.
