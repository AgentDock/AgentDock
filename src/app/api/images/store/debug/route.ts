import { listStoredImages, getStoredImage } from '../../../../../lib/image-store';
import { logger, LogCategory } from 'agentdock-core';

// Set runtime to Node.js instead of Edge
export const runtime = 'nodejs';

/**
 * GET handler for debugging the image store
 * Returns a list of all stored image IDs and basic metadata
 * This is only meant for development and troubleshooting
 * GET /api/images/store/debug
 */
export async function GET() {
  try {
    // Get all image IDs in the store
    const imageIds = listStoredImages();

    // Log the attempt
    logger.debug(
      LogCategory.API,
      'ImageStore',
      `Debug endpoint called, found ${imageIds.length} images`,
    );

    // Get basic metadata for each image
    const images = imageIds.map((id) => {
      const image = getStoredImage(id);
      if (!image) return { id, exists: false };

      return {
        id,
        exists: true,
        mimeType: image.mimeType,
        promptLength: image.prompt.length,
        dataLength: image.imageData.length,
        hasDescription: !!image.description,
      };
    });

    // Return the list as JSON
    return Response.json({
      count: imageIds.length,
      images,
    });
  } catch (error) {
    logger.error(LogCategory.API, 'ImageStore', 'Error in debug endpoint', {
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        error: 'Error querying image store',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
