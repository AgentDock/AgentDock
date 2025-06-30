import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,

  // External dependencies - extracted from package.json build command
  external: [
    // AI/LLM providers
    'ai',
    '@ai-sdk/*',
    '@anthropic-ai/*',
    '@google/*',
    'openai',

    // Database drivers
    'better-sqlite3',
    'pg',
    'mongodb',

    // Cloud/Storage providers
    '@upstash/*',
    '@vercel/*',
    '@aws-sdk/*',
    '@aws-sdk/client-s3',
    '@aws-sdk/lib-storage',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/types',

    // Validation
    'zod'
  ]
});
