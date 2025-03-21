import { logger, LogCategory } from 'agentdock-core';

// Define interface for stored images
export interface StoredImage {
  imageData: string;  // base64 image data without the prefix
  mimeType: string;   // image MIME type (e.g., 'image/png')
  prompt: string;     // original prompt
  description: string | null; // optional description
}

// Create a more durable store by using Node.js global object
// This ensures the store persists across API invocations in production
declare global {
  var imageStoreGlobal: Map<string, StoredImage>;
}

// Initialize the global store if it doesn't exist
if (!global.imageStoreGlobal) {
  global.imageStoreGlobal = new Map<string, StoredImage>();
  logger.info(
    LogCategory.SYSTEM,
    'ImageStore',
    'Initialized global image store'
  );
}

// Reference to the global store
const imageStore = global.imageStoreGlobal;

/**
 * Generate a unique ID for an image
 */
export function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store an image in the server-side memory store
 */
export function storeImage(id: string, image: StoredImage): void {
  imageStore.set(id, image);
  
  logger.debug(
    LogCategory.SYSTEM, 
    'ImageStore', 
    `Image stored with ID: ${id}`, 
    { storeSize: imageStore.size }
  );
}

/**
 * Get an image from the server-side memory store
 */
export function getStoredImage(id: string): StoredImage | undefined {
  const image = imageStore.get(id);
  
  logger.debug(
    LogCategory.SYSTEM, 
    'ImageStore', 
    `Retrieving image with ID: ${id}`, 
    { found: !!image, storeSize: imageStore.size }
  );
  
  return image;
}

/**
 * List all images in the store (for debugging)
 */
export function listStoredImages(): string[] {
  return Array.from(imageStore.keys());
}

/**
 * Store a base64 image and return a reference URL
 */
export function storeAndGetImageUrl(
  base64Data: string, 
  mimeType: string,
  prompt: string,
  description: string | null,
  origin: string = ''  // Default to empty string for backward compatibility
): string {
  // Extract the base64 data without the prefix
  const base64Content = base64Data.startsWith('data:') 
    ? base64Data.split(',')[1] 
    : base64Data;
    
  // Generate a unique ID
  const imageId = generateImageId();
  
  // Store the image data
  storeImage(imageId, {
    imageData: base64Content,
    mimeType,
    prompt,
    description
  });
  
  // Return a reference URL to the image, use absolute URL if origin is provided
  const relativePath = `/api/images/store/${imageId}`;
  return origin ? `${origin}${relativePath}` : relativePath;
}

/**
 * Check if a URL is an image store reference
 */
export function isImageStoreUrl(url: string): boolean {
  return url.startsWith('/api/images/store/');
}

/**
 * Get the image ID from a reference URL
 */
export function getImageIdFromUrl(url: string): string | null {
  if (!isImageStoreUrl(url)) return null;
  
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Get the base64 data URL from an image store URL
 * This is useful when we need to send the actual image data to an API
 * that doesn't accept URLs (like Google Gemini)
 */
export async function getImageDataFromUrl(url: string): Promise<string | null> {
  try {
    // Handle absolute URLs from different origins
    const isAbsoluteUrl = url.startsWith('http://') || url.startsWith('https://');
    
    // Extract the image ID
    let imageId: string | null = null;
    
    if (isAbsoluteUrl) {
      // For absolute URLs, extract the path and get the ID
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      imageId = getImageIdFromUrl(path);
    } else {
      // For relative URLs, get the ID directly
      imageId = getImageIdFromUrl(url);
    }
    
    // If we couldn't extract an ID, or it's not an image store URL, return null
    if (!imageId) {
      logger.warn(
        LogCategory.SYSTEM,
        'ImageStore',
        `Failed to extract image ID from URL: ${url}`
      );
      return null;
    }
    
    // Try to get the image directly from memory first (most efficient)
    const storedImage = getStoredImage(imageId);
    if (storedImage) {
      logger.debug(
        LogCategory.SYSTEM,
        'ImageStore',
        `Retrieved image data from memory for ID: ${imageId}`
      );
      
      // Reconstruct the data URL from the stored image
      return `data:${storedImage.mimeType};base64,${storedImage.imageData}`;
    }
    
    // If not in memory (unlikely in our setup, but for robustness), 
    // fetch it from the API endpoint
    logger.debug(
      LogCategory.SYSTEM,
      'ImageStore',
      `Image not found in memory, fetching from API: ${imageId}`
    );
    
    // Determine the API URL based on whether we're on client or server
    // and whether the original URL was absolute
    let apiUrl: string;
    if (typeof window !== 'undefined') {
      // Client-side: use the window.location.origin
      const origin = window.location.origin;
      apiUrl = `${origin}/api/images/store/${imageId}`;
    } else if (isAbsoluteUrl) {
      // Server-side with absolute URL: use the same origin as the input URL
      const parsedUrl = new URL(url);
      apiUrl = `${parsedUrl.origin}/api/images/store/${imageId}`;
    } else {
      // Server-side with relative URL: we need an origin, but don't have one
      logger.error(
        LogCategory.SYSTEM,
        'ImageStore',
        `Cannot fetch image on server without origin: ${url}`
      );
      return null;
    }
    
    // Fetch the image from the API
    const response = await fetch(apiUrl);
    if (!response.ok) {
      logger.error(
        LogCategory.SYSTEM,
        'ImageStore',
        `Failed to fetch image from API: ${apiUrl}`,
        { status: response.status }
      );
      return null;
    }
    
    // Get the image data and MIME type
    const imageData = await response.arrayBuffer();
    const mimeType = response.headers.get('Content-Type') || 'image/png';
    
    // Convert to base64
    const base64 = Buffer.from(imageData).toString('base64');
    
    // Return as data URL
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    logger.error(
      LogCategory.SYSTEM,
      'ImageStore',
      `Error getting image data from URL: ${url}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
} 