/**
 * @fileoverview Embedding model factory for AgentDock
 *
 * Creates embedding models from various providers following the same pattern
 * as createLLM. Centralizes embedding model creation to avoid hardcoded
 * provider references throughout the codebase.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingModel } from 'ai';

import { createError, ErrorCode } from '../errors';
import { LogCategory, logger } from '../logging';

/*
  TODO: Embedding Dimensions Reference
  =====================================
  openai/text-embedding-3-small: 1536
  openai/text-embedding-3-large: 3072
  google/text-embedding-004: 768
  mistral/mistral-embed: 1024
  voyage/voyage-3: 1024
  voyage/voyage-3-lite: 512
  cohere/embed-english-v3.0: 1024
  
  Important for vector database schema planning
*/

// Add these imports when packages are available:
// import { createMistral } from '@ai-sdk/mistral';
// import { createVoyage } from '@ai-sdk/voyage';
// import { createCohere } from '@ai-sdk/cohere';

/**
 * Configuration for creating embedding models
 */
export interface EmbeddingConfig {
  provider:
    | 'openai'
    | 'google'
    | 'mistral'
    | 'voyage'
    | 'cohere'
    | 'anthropic'
    | 'groq'
    | 'cerebras'
    | 'deepseek';
  apiKey: string;
  model?: string;
  dimensions?: number;
}

/**
 * Creates an embedding model based on the provided configuration
 *
 * @param config - Embedding configuration
 * @returns Configured embedding model
 * @throws Error if provider doesn't support embeddings
 */
export function createEmbedding(
  config: EmbeddingConfig
): EmbeddingModel<string> {
  logger.debug(LogCategory.LLM, 'createEmbedding', 'Creating embedding model', {
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions
  });

  switch (config.provider) {
    case 'openai': {
      if (!config.apiKey) {
        throw createError(
          'llm',
          'OpenAI API key is required for embeddings',
          ErrorCode.LLM_API_KEY
        );
      }

      const model = config.model || 'text-embedding-3-small';
      logger.info(
        LogCategory.LLM,
        'createEmbedding',
        'Creating OpenAI embedding model',
        { model }
      );

      const provider = createOpenAI({ apiKey: config.apiKey });
      return provider.embedding(model);
    }

    case 'google': {
      if (!config.apiKey) {
        throw createError(
          'llm',
          'Google API key is required for embeddings',
          ErrorCode.LLM_API_KEY
        );
      }

      const model = config.model || 'text-embedding-004';
      logger.info(
        LogCategory.LLM,
        'createEmbedding',
        'Creating Google embedding model',
        { model }
      );

      const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return provider.textEmbeddingModel(model);
    }

    case 'anthropic':
      throw createError(
        'llm',
        'Anthropic does not currently support embeddings',
        ErrorCode.LLM_EXECUTION
      );

    case 'groq':
      throw createError(
        'llm',
        'Groq does not currently support embeddings',
        ErrorCode.LLM_EXECUTION
      );

    case 'cerebras':
      throw createError(
        'llm',
        'Cerebras does not currently support embeddings',
        ErrorCode.LLM_EXECUTION
      );

    case 'deepseek':
      throw createError(
        'llm',
        'DeepSeek does not currently support embeddings',
        ErrorCode.LLM_EXECUTION
      );

    /* TODO: Uncomment when packages are available
    case 'mistral': {
      if (!config.apiKey) {
        throw createError('llm', 'Mistral API key is required', ErrorCode.LLM_API_KEY);
      }
      const provider = createMistral({ apiKey: config.apiKey });
      return provider.embedding(config.model || 'mistral-embed');
    }

    case 'voyage': {
      if (!config.apiKey) {
        throw createError('llm', 'Voyage API key is required', ErrorCode.LLM_API_KEY);
      }
      const provider = createVoyage({ apiKey: config.apiKey });
      return provider.embedding(config.model || 'voyage-3');
    }

    case 'cohere': {
      if (!config.apiKey) {
        throw createError('llm', 'Cohere API key is required', ErrorCode.LLM_API_KEY);
      }
      const provider = createCohere({ apiKey: config.apiKey });
      return provider.embedding(config.model || 'embed-english-v3.0');
    }
    */

    default:
      throw createError(
        'llm',
        `Provider ${config.provider} does not support embeddings`,
        ErrorCode.LLM_EXECUTION
      );
  }
}

/**
 * Gets the default embedding model for a provider
 */
export function getDefaultEmbeddingModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'text-embedding-3-small';
    case 'google':
      return 'text-embedding-004';
    // TODO: Uncomment when packages available:
    // case 'mistral': return 'mistral-embed';
    // case 'voyage': return 'voyage-3';
    // case 'cohere': return 'embed-english-v3.0';
    default:
      throw createError(
        'llm',
        `Provider ${provider} does not support embeddings`,
        ErrorCode.LLM_EXECUTION
      );
  }
}

/**
 * Gets the embedding dimensions for a model
 */
export function getEmbeddingDimensions(
  provider: string,
  model: string
): number {
  if (provider === 'openai') {
    switch (model) {
      case 'text-embedding-3-small':
        return 1536;
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536; // Default OpenAI dimension
    }
  }

  if (provider === 'google') {
    return 768; // Google's text-embedding-004 dimension
  }

  /* TODO: Uncomment when packages available:
  if (provider === 'mistral') {
    return 1024; // Mistral's mistral-embed dimension
  }

  if (provider === 'voyage') {
    switch (model) {
      case 'voyage-3':
        return 1024;
      case 'voyage-3-lite':
        return 512;
      default:
        return 1024;
    }
  }

  if (provider === 'cohere') {
    return 1024; // Cohere's embed-english-v3.0 dimension
  }
  */

  return 1536; // Default dimension
}
