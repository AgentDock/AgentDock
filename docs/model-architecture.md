# Model Architecture

This document explains the model architecture in the AgentDock reference implementation.

## Overview

The model architecture follows a clean, consistent pattern that separates concerns and avoids redundancy:

1. **API Routes**: Handle provider-specific model fetching and validation
2. **Model Registry**: Stores model metadata in memory
3. **Model Service**: Provides a centralized way to interact with models

## Directory Structure

```
src/
├── app/
│   └── api/
│       └── providers/
│           ├── models/         # Generic models endpoint
│           ├── anthropic/
│           │   └── models/     # Anthropic-specific models endpoint
│           ├── openai/
│           │   └── models/     # OpenAI-specific models endpoint
│           ├── gemini/
│           │   └── models/     # Gemini-specific models endpoint
│           └── deepseek/
│               └── models/     # DeepSeek-specific models endpoint
└── lib/
    ├── models/
    │   └── registry.ts         # Central model registry
    └── services/
        └── model-service.ts    # Model service for interacting with models
```

## Components

### API Routes

1. **Provider-Specific Routes** (`/api/providers/{provider}/models`):
   - Fetch models from the provider's API
   - Validate API keys
   - Register models with the ModelRegistry

2. **Generic Models Route** (`/api/providers/models`):
   - Return models from the registry
   - Do not fetch models from provider APIs

### Model Registry

The `ModelRegistry` class in `src/lib/models/registry.ts`:
- Stores model metadata in memory
- Organizes models by provider
- Provides methods to register, get, and reset models

### Model Service

The `ModelService` class in `src/lib/services/model-service.ts`:
- Provides a centralized way to interact with models
- Handles API calls to fetch and register models
- Manages model registration and retrieval

## Flow

1. **Initialization**:
   - The application starts with an empty model registry

2. **API Key Configuration**:
   - User provides an API key for a provider
   - Application validates the API key using the provider-specific endpoint
   - If valid, the endpoint fetches models from the provider's API and registers them with the registry

3. **Model Usage**:
   - Application retrieves models from the registry using the ModelService
   - No additional API calls are made unless the models need to be refreshed

## Integration with agentdock-core

The reference implementation consumes the agentdock-core package, which provides:
- Provider types (`anthropic`, `openai`, `gemini`, `deepseek`)
- A `ProviderRegistry` class for provider metadata
- Model creation functions for each provider
- A unified `CoreLLM` class that works with any provider

The reference implementation extends this with:
- A dynamic model registry for runtime model registration
- API routes for fetching models from provider APIs
- A service layer for simplified model interaction

## Best Practices

1. **Single Source of Truth**:
   - The ModelRegistry is the single source of truth for model metadata
   - Provider-specific API routes are the only place where models are fetched from provider APIs

2. **Separation of Concerns**:
   - API routes handle HTTP requests and responses
   - ModelRegistry handles model storage
   - ModelService provides a clean interface for model operations

3. **DRY (Don't Repeat Yourself)**:
   - Common functionality is centralized in the ModelService
   - Provider-specific logic is isolated to provider-specific routes

4. **KISS (Keep It Simple, Stupid)**:
   - The architecture is simple and easy to understand
   - Each component has a clear, single responsibility
   - All provider-related endpoints are organized under a common path 