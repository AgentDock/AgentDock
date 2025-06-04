import { z } from 'zod';

/**
 * Schema for the Critique tool parameters
 */
export const CritiqueSchema = z.object({
  /**
   * The subject being critiqued - could be code, writing, an argument, a design, etc.
   * @example "JavaScript function for data validation"
   */
  subject: z
    .string()
    .min(1, 'Subject is required')
    .describe('What is being critiqued'),

  /**
   * The detailed critique analysis in a structured format
   * @example "UNDERSTANDING: This code performs data validation...\nSTRENGTHS:..."
   */
  analysis: z
    .string()
    .min(1, 'Analysis is required')
    .describe(
      'Detailed critique analysis with understanding, strengths, issues, suggestions, and assessment'
    )
});

/**
 * Type definition for the Critique tool parameters
 */
export type CritiqueParameters = z.infer<typeof CritiqueSchema>;

/**
 * Default values for the Critique parameters
 */
export const defaultCritiqueParams: Partial<CritiqueParameters> = {};
