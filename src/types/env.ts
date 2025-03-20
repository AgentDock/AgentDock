/**
 * @fileoverview Environment configuration types
 * These types define the shape of our environment configuration and provide centralized
 * access to environment variables throughout the application.
 * 
 * Environment Variables Usage:
 * 1. Add environment variables to your .env.local file (for development)
 * 2. Set up environment variables in your deployment platform (for production)
 * 
 * Required Environment Variables:
 * - At least one LLM provider API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
 * 
 * Optional Environment Variables:
 * - FALLBACK_API_KEY: Used as a backup when primary API keys fail
 * - MAX_DURATION: Maximum duration for Edge functions in seconds (default: 300)
 */

import { LLMProvider } from 'agentdock-core';

/**
 * TEMPORARY SOLUTION:
 * This interface and the related functions will eventually be replaced
 * by a more comprehensive solution that integrates with agentdock-core's
 * ProviderRegistry, allowing us to get provider information dynamically.
 */
export interface EnvConfig {
  // LLM Provider API Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
}

/**
 * Get environment configuration
 * This will be moved to a proper config manager that integrates with
 * agentdock-core's ProviderRegistry in the future
 * 
 * @returns EnvConfig object containing all environment variables
 */
export function getEnvConfig(): EnvConfig {
  return {
    // LLM Provider API Keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY
  };
}

/**
 * Get LLM provider API key from environment variables
 * 
 * This function centralizes access to LLM provider API keys, making it the
 * preferred way to access these keys throughout the application. It ensures
 * consistent access patterns and will make future enhancements easier.
 * 
 * Usage example:
 * ```typescript
 * const openaiKey = getProviderApiKey('openai');
 * if (openaiKey) {
 *   // Use the API key
 * } else {
 *   // Handle missing API key
 * }
 * ```
 * 
 * @param provider LLM provider ID (e.g., 'anthropic', 'openai', 'gemini')
 * @returns The API key string or null if not found
 */
export function getProviderApiKey(provider: LLMProvider): string | null {
  const env = getEnvConfig();
  
  // Map provider ID to environment variable
  const keyMap: Record<string, string | undefined> = {
    'anthropic': env.ANTHROPIC_API_KEY,
    'openai': env.OPENAI_API_KEY, 
    'gemini': env.GEMINI_API_KEY,
    'deepseek': env.DEEPSEEK_API_KEY,
    'groq': env.GROQ_API_KEY
  };
  
  return keyMap[provider] || null;
} 