/**
 * @fileoverview Utilities for the image generation tool.
 * Contains the core functionality for generating images using Gemini API.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, LogCategory } from 'agentdock-core';
import { getProviderApiKey } from '@/types/env';

// Define the model ID for Gemini 2.0 Flash experimental
const MODEL_ID = 'gemini-2.0-flash-exp';

/**
 * Result interface for generated images
 */
export interface GeneratedImageResult {
  imageUrl: string;
  description: string | undefined;
}

/**
 * Maximum image size to prevent API response issues
 */
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

/**
 * Generate or edit an image using Google Gemini API
 */
export async function generateImage(prompt: string, inputImage?: string): Promise<GeneratedImageResult> {
  logger.debug(LogCategory.NODE, '[ImageGeneration]', `Executing ${inputImage ? 'image edit' : 'image generation'} for prompt: ${prompt}`);
  
  try {
    // =====================================================================
    // IMPORTANT: Image generation always uses the environment variable for
    // the API key, not the agent-specific or global settings keys.
    // This is to ensure consistent behavior when generating images.
    // =====================================================================
    
    // Get the API key from environment variables
    const geminiApiKey = getProviderApiKey('gemini');
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required but not found in environment variables');
    }
    
    // Initialize the Google Gen AI client with the API key
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    
    // Get the model with the correct configuration
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        // @ts-expect-error - Gemini API JS is missing this type
        responseModalities: ["Text", "Image"],
      },
    });
    
    // Create a chat session
    const chat = model.startChat({
      history: [],
    });
    
    // Prepare the message parts
    const messageParts = [];
    
    // Add the text prompt
    messageParts.push({ text: prompt });
    
    // Add the image if provided for editing
    if (inputImage) {
      logger.debug(LogCategory.NODE, '[ImageGeneration]', 'Processing image edit request');
      
      try {
        // Check if the image is a valid data URL
        if (!inputImage.startsWith('data:')) {
          throw new Error('Invalid image data URL format');
        }
        
        const imageParts = inputImage.split(',');
        if (imageParts.length < 2) {
          throw new Error('Invalid image data URL format');
        }
        
        const base64Image = imageParts[1];
        const mimeType = inputImage.includes('image/png') ? 'image/png' : 'image/jpeg';
        
        // Check image size before sending to API
        const estimatedSize = base64Image.length * 0.75; // Base64 is ~4/3 the size of binary
        if (estimatedSize > MAX_IMAGE_SIZE) {
          throw new Error(`Image is too large (${Math.round(estimatedSize / 1024 / 1024)}MB). Maximum size is 4MB.`);
        }
        
        logger.debug(
          LogCategory.NODE,
          '[ImageGeneration]',
          `Processing image with MIME type: ${mimeType}`,
          { dataLength: base64Image.length }
        );
        
        // Add the image to message parts
        messageParts.push({
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        });
      } catch (imageError) {
        logger.error(
          LogCategory.NODE, 
          '[ImageGeneration]', 
          'Error processing input image:',
          { error: imageError instanceof Error ? imageError.message : String(imageError) }
        );
        throw imageError;
      }
    }
    
    // Send the message to the chat
    logger.debug(
      LogCategory.NODE,
      '[ImageGeneration]',
      `Sending message with ${messageParts.length} parts`
    );
    
    // Set timeout and retry logic
    const maxRetries = 2;
    let retryCount = 0;
    let result: { response: any } | null = null;
    
    while (retryCount <= maxRetries) {
      try {
        // Use Promise.race to implement a timeout
        result = await Promise.race([
          chat.sendMessage(messageParts) as Promise<{ response: any }>,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000)
          )
        ]);
        break; // Success, exit the retry loop
      } catch (apiError) {
        retryCount++;
        if (retryCount > maxRetries) {
          logger.error(
            LogCategory.NODE,
            '[ImageGeneration]',
            `API request failed after ${maxRetries} retries:`,
            { error: apiError instanceof Error ? apiError.message : String(apiError) }
          );
          throw apiError;
        }
        
        // Log retry attempt
        logger.warn(
          LogCategory.NODE,
          '[ImageGeneration]',
          `API request failed, retrying (${retryCount}/${maxRetries}):`,
          { error: apiError instanceof Error ? apiError.message : String(apiError) }
        );
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (!result) {
      throw new Error('Failed to get a response from the API');
    }
    
    const response = result.response;
    
    let textResponse = undefined;
    let imageData = null;
    let mimeType = 'image/png';
    
    // Process the response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      logger.debug(
        LogCategory.NODE,
        '[ImageGeneration]',
        `Number of parts in response: ${parts.length}`
      );
      
      for (const part of parts) {
        if ("inlineData" in part && part.inlineData) {
          // Get the image data
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          logger.debug(
            LogCategory.NODE,
            '[ImageGeneration]',
            `Image data received, MIME type: ${mimeType}`,
            { dataLength: imageData?.length || 0 }
          );
        } else if ("text" in part && part.text) {
          // Store the text
          textResponse = part.text;
          logger.debug(
            LogCategory.NODE,
            '[ImageGeneration]',
            `Text response received: ${textResponse?.substring(0, 50)}...`
          );
        }
      }
    }
    
    // Check if we got an image
    if (!imageData) {
      throw new Error('No image was generated');
    }
    
    // Clean up the image data by removing whitespace
    imageData = imageData.trim();
    
    // Create a properly formatted data URL that works for direct display in HTML
    const imageUrl = `data:${mimeType};base64,${imageData}`;
    
    // Log the result
    logger.debug(
      LogCategory.NODE,
      '[ImageGeneration]',
      `Generated result with URL length: ${imageUrl.length}`,
      {
        hasDescription: !!textResponse,
        mimeType
      }
    );
    
    // Return the formatted result
    return {
      imageUrl,
      description: textResponse
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[ImageGeneration]', 'Error generating image:', { 
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 