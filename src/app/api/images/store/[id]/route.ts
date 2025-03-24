import { NextRequest } from 'next/server';
import { getStoredImage } from '../../../../../lib/image-store';
import { logger, LogCategory } from 'agentdock-core';

// Set runtime to Node.js instead of Edge
export const runtime = 'nodejs';

// Define CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * GET handler for retrieving stored images by ID
 * This endpoint serves images stored in the server-side memory store
 * GET /api/images/store/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Properly await the params object first
    const { id } = await params;
    
    // Debug logging
    logger.debug(
      LogCategory.API,
      'ImageStore',
      `GET request for image ID: ${id}`,
      { url: request.url }
    );
    
    if (!id) {
      logger.warn(
        LogCategory.API,
        'ImageStore',
        'Missing image ID in request'
      );
      return new Response('Missing image ID', { status: 400 });
    }
    
    const image = getStoredImage(id);
    
    if (!image) {
      logger.warn(
        LogCategory.API,
        'ImageStore',
        `Image not found with ID: ${id}`
      );
      return new Response('Image not found', { status: 404 });
    }
    
    // Log successful image retrieval
    logger.info(
      LogCategory.API,
      'ImageStore',
      `Successfully retrieved image with ID: ${id}`,
      { 
        mimeType: image.mimeType,
        dataLength: image.imageData.length
      }
    );
    
    // Convert base64 to buffer
    const buffer = Buffer.from(image.imageData, 'base64');
    
    // Return the image with appropriate headers
    const headers = {
      'Content-Type': image.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      ...CORS_HEADERS,
    };
    
    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error(
      LogCategory.API,
      'ImageStore',
      'Error retrieving image',
      { error: error instanceof Error ? error.message : String(error) }
    );
    
    return new Response('Error retrieving image', { status: 500 });
  }
} 