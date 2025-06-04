import { NextRequest } from 'next/server';
import { LogCategory, logger } from 'agentdock-core';

import { generateImageAction } from './actions';

// Set runtime to Node.js instead of Edge
export const runtime = 'nodejs';

/**
 * API endpoint for generating images using Google's Gemini API
 * POST /api/images/gemini
 */
export async function POST(req: NextRequest) {
  try {
    // Parse JSON request
    const requestData = await req.json();
    const { prompt, image: inputImage } = requestData;

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get the origin from the request
    const origin = req.headers.get('origin') || req.nextUrl.origin;

    logger.debug(
      LogCategory.API,
      'ImageGenerationAPI',
      `Processing API request with prompt: ${prompt.substring(0, 20)}...`,
      { origin }
    );

    try {
      // Use the Server Action instead of direct API implementation
      // Pass the origin to the action
      const result = await generateImageAction(prompt, inputImage, origin);

      // Return the result as JSON
      return Response.json(result);
    } catch (error) {
      logger.error(
        LogCategory.API,
        'ImageGenerationAPI',
        'Error in generateImageAction',
        { error }
      );
      throw error;
    }
  } catch (error) {
    logger.error(
      LogCategory.API,
      'ImageGenerationAPI',
      'Error generating image',
      { error }
    );

    return Response.json(
      {
        error: 'Failed to generate image',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
