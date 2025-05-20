import { z } from 'zod';

/**
 * Schema for the Brainstorm tool parameters
 */
export const BrainstormSchema = z.object({
  /**
   * The challenge or problem to brainstorm ideas for
   * @example "How to improve remote team collaboration"
   */
  challenge: z
    .string()
    .min(1, 'Challenge is required')
    .describe('The problem or topic to brainstorm ideas for'),

  /**
   * The structured collection of ideas with categories and explanations
   * @example "PROBLEM FRAMING: Remote collaboration lacks...\nCATEGORY 1: Communication Tools..."
   */
  ideas: z
    .string()
    .min(1, 'Ideas are required')
    .describe('Structured collection of creative ideas with categories and explanations'),
});

/**
 * Type definition for the Brainstorm tool parameters
 */
export type BrainstormParameters = z.infer<typeof BrainstormSchema>;

/**
 * Default values for the Brainstorm parameters
 */
export const defaultBrainstormParams: Partial<BrainstormParameters> = {};
