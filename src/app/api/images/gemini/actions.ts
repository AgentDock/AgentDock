'use server';

import { headers } from 'next/headers';
import { GoogleGenerativeAI, LogCategory, logger } from 'agentdock-core';

import { getProviderApiKey } from '@/types/env';
import { storeAndGetImageUrl } from '../../../../lib/image-store';

// Define the model ID for Gemini 2.0 Flash experimental
const MODEL_ID = 'gemini-2.0-flash-exp';

/**
 * Server Action for image generation using Google's Gemini API
 * This can be called directly from both client components and server components
 */
export async function generateImageAction(
  prompt: string,
  inputImage?: string,
  originUrl?: string // Optional origin URL for absolute path
): Promise<{
  image: string;
  description: string | null;
}> {
  try {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Try to get origin from headers if not provided
    let origin = originUrl || '';
    if (!origin) {
      try {
        const headersList = await headers();
        const referer = headersList.get('referer');
        if (referer) {
          const url = new URL(referer);
          origin = url.origin;
        }
      } catch (e) {
        logger.warn(
          LogCategory.API,
          'ImageGenerationAPI',
          'Could not determine origin from headers'
        );
      }
    }

    // =====================================================================
    // IMPORTANT: Image generation always uses the environment variable for
    // the API key, not the agent-specific or global settings keys.
    // This is to ensure consistent behavior when generating images.
    // =====================================================================

    // Get the API key from environment variables
    const geminiApiKey = getProviderApiKey('gemini');

    if (!geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY is required but not found in environment variables'
      );
    }

    // Initialize the Google Gen AI client
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Initialize the model with the right configuration
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        // @ts-expect-error - Gemini API JS is missing this type
        responseModalities: ['Text', 'Image']
      }
    });

    // Log the image generation request
    logger.info(
      LogCategory.API,
      'ImageGenerationAPI',
      `Generating image for prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      { inputImage: !!inputImage }
    );

    // Generate the image
    const contentParts = [];

    // Add text prompt
    contentParts.push({ text: prompt });

    // Add input image if provided
    if (inputImage) {
      contentParts.push({
        inlineData: {
          data: inputImage.split(',')[1],
          mimeType: 'image/png'
        }
      });
    }

    const result = await model.generateContent(contentParts);

    // Extract the response
    const response = result.response;
    const text = response.text();
    const textResponse = text && text.length > 0 ? text : null;

    // Process the image parts from the response
    const imageParts = response.candidates?.[0]?.content?.parts?.filter(
      (part) => part.inlineData && part.inlineData.mimeType.startsWith('image/')
    );

    if (!imageParts || imageParts.length === 0) {
      throw new Error('No image was generated');
    }

    // Get the image data
    const imagePart = imageParts[0];
    if (!imagePart.inlineData) {
      throw new Error('No image data in response');
    }

    const { data, mimeType } = imagePart.inlineData;
    if (!data) {
      throw new Error('Empty image data in response');
    }

    // Store the image and get a reference URL (now async)
    const imageUrl = await storeAndGetImageUrl(
      data,
      mimeType,
      prompt,
      textResponse,
      origin
    );

    logger.info(
      LogCategory.API,
      'ImageGenerationAPI',
      `Image generated and stored successfully`,
      {
        prompt: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
        imageUrl
      }
    );

    return {
      image: imageUrl,
      description: textResponse
    };
  } catch (error) {
    logger.error(
      LogCategory.API,
      'ImageGenerationAPI',
      'Failed to generate image',
      {
        error: error instanceof Error ? error.message : String(error),
        prompt: prompt ? prompt.substring(0, 100) : null
      }
    );

    throw error;
  }
}
