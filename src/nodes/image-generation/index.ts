/**
 * @fileoverview Image generation tool implementation
 * Provides image generation and editing functionality using Google's Gemini API.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../types';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for image generation tool parameters
 */
const imageGenerationSchema = z.object({
  prompt: z.string().describe('Text prompt describing the image to generate or edit'),
  image: z
    .string()
    .optional()
    .describe(
      'Optional base64 image data URL to edit (if provided, the tool will edit this image based on the prompt)',
    ),
});

/**
 * Type inference from schema
 */
type ImageGenerationParams = z.infer<typeof imageGenerationSchema>;

/**
 * Image generation tool implementation
 * Uses the Google Gemini API endpoint for image generation
 */
export const imageGenerationTool: Tool = {
  name: 'generate_image',
  description: 'Generate or edit images based on text prompts using Google Gemini',
  parameters: imageGenerationSchema,
  async execute({ prompt, image }: ImageGenerationParams, options: ToolExecutionOptions) {
    logger.debug(
      LogCategory.NODE,
      '[ImageGeneration]',
      `Executing ${image ? 'image edit' : 'image generation'} for prompt: "${prompt}"`,
      {
        toolCallId: options.toolCallId,
        hasImage: !!image,
      },
    );

    try {
      // Validate prompt
      if (!prompt || !prompt.trim()) {
        logger.warn(LogCategory.NODE, '[ImageGeneration]', 'Empty prompt provided');
        return `Error generating image: Please provide a non-empty prompt.`;
      }

      // Call the API endpoint directly with fetch
      try {
        // Get the origin to construct an absolute URL
        const origin =
          typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const apiUrl = `${origin}/api/images/gemini`;

        logger.debug(
          LogCategory.NODE,
          '[ImageGeneration]',
          `Calling Gemini image generation API at: ${apiUrl}`,
          { prompt: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '') },
        );

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            image,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API returned ${response.status}`);
        }

        const result = await response.json();

        // Check if we have a valid image URL in the result
        if (!result.image) {
          logger.warn(LogCategory.NODE, '[ImageGeneration]', 'No image in result');
          throw new Error('No image was generated');
        }

        // Ensure the image URL is absolute
        const imageUrl = result.image.startsWith('http')
          ? result.image
          : `${origin}${result.image.startsWith('/') ? '' : '/'}${result.image}`;

        logger.info(LogCategory.NODE, '[ImageGeneration]', 'Image generated successfully', {
          promptLength: prompt.length,
          hasDescription: !!result.description,
          imageUrl,
        });

        // Return a simpler response that's more compatible with Vercel AI SDK
        return {
          url: imageUrl,
          prompt: prompt,
          description: result.description || null,
        };
      } catch (actionError) {
        // Specific handling for API errors
        const errorMessage =
          actionError instanceof Error ? actionError.message : String(actionError);
        logger.error(LogCategory.NODE, '[ImageGeneration]', 'API error:', {
          error: errorMessage,
          toolCallId: options.toolCallId,
        });

        return `Image generation failed: ${errorMessage}`;
      }
    } catch (error: unknown) {
      // General error handling
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(LogCategory.NODE, '[ImageGeneration]', 'Image generation error:', {
        error: errorMessage,
        toolCallId: options.toolCallId,
      });

      // Return a simpler error message
      return `Error generating image for prompt: "${prompt}". Error: ${errorMessage}`;
    }
  },
};

/**
 * Export tools for registry
 */
export const tools = {
  generate_image: imageGenerationTool,
};
