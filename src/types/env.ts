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
import { z } from 'zod';

// Define schema for validating environment variables
const envSchema = z.object({
  // LLM Provider API Keys - make all optional but validate format when present
  ANTHROPIC_API_KEY: z.string().min(1).startsWith('sk-ant-').optional(),
  OPENAI_API_KEY: z.string().min(1).startsWith('sk-').optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).startsWith('gsk_').optional(),
  
  // Other API keys
  SERPER_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  ALPHAVANTAGE_API_KEY: z.string().min(1).optional(),
  
  // Application configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  FALLBACK_API_KEY: z.string().optional(),
  MAX_DURATION: z.string().transform(val => parseInt(val, 10)).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

// Type inferring from schema
type EnvConfig = z.infer<typeof envSchema>;

/**
 * Get environment configuration with validation
 * 
 * @returns EnvConfig object containing all environment variables
 */
export function getEnvConfig(): EnvConfig {
  try {
    // Parse environment variables through the schema
    const env = envSchema.parse({
      // LLM Provider API Keys
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      
      // Other API keys
      SERPER_API_KEY: process.env.SERPER_API_KEY,
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
      ALPHAVANTAGE_API_KEY: process.env.ALPHAVANTAGE_API_KEY,
      
      // Application configuration
      NODE_ENV: process.env.NODE_ENV,
      FALLBACK_API_KEY: process.env.FALLBACK_API_KEY,
      MAX_DURATION: process.env.MAX_DURATION,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    });
    
    // Log environment information in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Environment variables loaded successfully');
      
      // Log which API keys are available (safely)
      const availableKeys = Object.entries(env)
        .filter(([key, value]) => key.includes('API_KEY') && value)
        .map(([key]) => key);
      
      console.log('Available API keys:', availableKeys);
    }
    
    return env;
  } catch (error) {
    // If in development, provide more details about missing/invalid env vars
    if (process.env.NODE_ENV === 'development') {
      console.error('Environment validation error:', error);
    } else {
      console.error('Environment validation failed. Check environment variables.');
    }
    
    // Return empty object as fallback - application will handle missing keys gracefully
    return {} as EnvConfig;
  }
}

/**
 * Get LLM provider API key from environment variables
 * 
 * This function centralizes access to LLM provider API keys, making it the
 * preferred way to access these keys throughout the application. It ensures
 * consistent access patterns and will make future enhancements easier.
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