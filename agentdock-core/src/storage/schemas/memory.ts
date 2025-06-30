/**
 * @fileoverview Zod validation schemas for memory data
 *
 * Provides type-safe validation for memory operations using Zod,
 * following patterns established in agent-config.ts
 */

import { z } from 'zod';

import { MemoryType } from '../../shared/types/memory';

/**
 * Memory metadata schema with proper typing
 */
export const MemoryMetadataSchema = z
  .object({
    contextWindow: z.number().int().min(1).optional(),
    expiresAt: z.number().int().min(0).optional(),
    context: z.string().optional(),
    category: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  })
  .catchall(z.unknown());

/**
 * Core memory data validation schema
 */
export const MemoryDataSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  agentId: z.string().min(1),
  type: z.nativeEnum(MemoryType),
  content: z.string().min(1),
  importance: z.number().min(0).max(1),
  resonance: z.number().min(0).max(1),
  accessCount: z.number().int().min(0),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
  lastAccessedAt: z.number().int().min(0),

  // Optional fields that exist in storage
  sessionId: z.string().min(1).optional(),
  tokenCount: z.number().int().min(0).optional(),
  keywords: z.array(z.string()).optional(),
  embeddingId: z.string().optional(),

  metadata: MemoryMetadataSchema.optional()
});

/**
 * Type derived from the validation schema
 */
export type ValidatedMemoryData = z.infer<typeof MemoryDataSchema>;

/**
 * Validation function with detailed error reporting
 */
export function validateMemoryData(data: unknown): {
  success: boolean;
  data?: ValidatedMemoryData;
  error?: string;
} {
  const result = MemoryDataSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    error: result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('; ')
  };
}

/**
 * Type guard for memory data
 */
export function isValidMemoryData(data: unknown): data is ValidatedMemoryData {
  return MemoryDataSchema.safeParse(data).success;
}

/**
 * Schema for memory recall options
 */
export const MemoryRecallOptionsSchema = z.object({
  type: z.nativeEnum(MemoryType).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  threshold: z.number().min(0).max(1).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  useVectorSearch: z.boolean().optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date()
    })
    .optional()
});

/**
 * Schema for memory operation statistics
 */
export const MemoryOperationStatsSchema = z.object({
  totalMemories: z.number().int().min(0),
  byType: z.record(z.string(), z.number().int().min(0)),
  avgImportance: z.number().min(0).max(1),
  totalSize: z.string()
});
