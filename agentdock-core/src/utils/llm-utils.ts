/**
 * @fileoverview Utility functions for LLM operations.
 * Provides a clean abstraction for tools to access LLM capabilities.
 */

import { CoreMessage } from 'ai';

import { createLLM, LLMConfig, LLMProvider } from '../llm';
import { LogCategory, logger } from '../logging';
import { LLMContext } from '../types/tools';

/**
 * Options for generating text with LLM
 */
export interface GenerateTextOptions {
  /** Messages to send to the LLM */
  messages: CoreMessage[];
  /** Temperature for generation (defaults to 0.7) */
  temperature?: number;
  /** Maximum tokens to generate (defaults to 1000) */
  maxTokens?: number;
  /** LLM context containing API key and model information */
  llmContext: LLMContext;
}

/**
 * Generate text using LLM from context
 * This is a utility function that tools can use to access LLM capabilities
 */
export async function generateTextFromContext(
  options: GenerateTextOptions
): Promise<string> {
  try {
    const {
      llmContext,
      messages,
      temperature = 0.7,
      maxTokens = 1000
    } = options;

    // Use the LLM instance from context if available
    if (llmContext.llm) {
      logger.debug(
        LogCategory.LLM,
        'LLMUtils',
        'Using existing LLM instance from context'
      );
      const result = await llmContext.llm.generateText({ messages });
      return result.text;
    }

    // Otherwise, create a new LLM instance
    logger.debug(
      LogCategory.LLM,
      'LLMUtils',
      'Creating new LLM instance from context'
    );

    // Validate API key
    if (!llmContext.apiKey) {
      logger.warn(
        LogCategory.LLM,
        'LLMUtils',
        'No API key available for LLM generation'
      );
      throw new Error('No API key available for LLM generation');
    }

    // Create LLM config
    const llmConfig: LLMConfig = {
      provider: llmContext.provider as LLMProvider,
      model: llmContext.model,
      apiKey: llmContext.apiKey,
      temperature,
      maxTokens
    };

    // Create LLM instance
    const llm = createLLM(llmConfig);

    // Generate text
    logger.debug(
      LogCategory.LLM,
      'LLMUtils',
      'Calling LLM for text generation'
    );
    const result = await llm.generateText({ messages });
    logger.debug(LogCategory.LLM, 'LLMUtils', 'LLM text generation completed');

    return result.text;
  } catch (error) {
    // Log the error
    logger.error(LogCategory.LLM, 'LLMUtils', 'LLM text generation failed:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error)
    });

    // Re-throw the error for the caller to handle
    throw error;
  }
}
