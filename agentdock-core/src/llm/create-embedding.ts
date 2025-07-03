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

/**
 * Configuration for creating embedding models
 */
export interface EmbeddingConfig {
  provider:
    | 'openai'
    | 'google'
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

  return 1536; // Default dimension
}
