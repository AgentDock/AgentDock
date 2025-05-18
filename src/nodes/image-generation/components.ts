/**
 * @fileoverview Image generation UI components for displaying generated images.
 * These components are used by the image generation tool to display information.
 */

import { formatHeader, formatBold, joinSections } from '@/lib/utils/markdown-utils';

/**
 * Generated image result interface
 */
export interface GeneratedImageResult {
  imageUrl: string;
  prompt: string;
  description?: string;
  originalImage?: string;
}

/**
 * Format a generated image result for chat display
 * Instead of using markdown for image rendering, we'll create a direct HTML component
 */
export function ImageGenerationResult(result: GeneratedImageResult) {
  // Create header based on if this was a generation or edit
  const header = result.originalImage
    ? formatHeader(`Image Edited: "${result.prompt}"`)
    : formatHeader(`Image Generated: "${result.prompt}"`);

  // Ensure the image URL has proper data URL format
  const imageUrl = ensureDataUrlFormat(result.imageUrl);

  // Create direct HTML for image display instead of using markdown
  const imageDisplay = `<div class="flex flex-col items-center mt-4 mb-4">
    <img src="${imageUrl}" alt="Generated image" class="max-w-[90%] rounded-md" />
  </div>`;

  // Add description if available
  const description = result.description
    ? `\n\n${formatBold('Description:')} ${result.description}`
    : '';

  // Add original image if this was an edit
  const originalImageSection = result.originalImage
    ? `\n\n${formatBold('Original Image:')}\n<div class="flex flex-col items-center mt-4 mb-4">
        <img src="${ensureDataUrlFormat(result.originalImage)}" alt="Original image" class="max-w-[90%] rounded-md" />
      </div>`
    : '';

  // Combine all sections
  const content = joinSections(header, imageDisplay, description + originalImageSection);

  // Return an object with the type and HTML content
  return {
    type: 'image_generation_result',
    content,
    // Add raw image data for direct access if needed
    imageData: {
      src: imageUrl,
      alt: 'Generated image',
      prompt: result.prompt,
      description: result.description,
    },
  };
}

/**
 * Helper function to ensure proper data URL format
 */
function ensureDataUrlFormat(url: string): string {
  // If it already has a data URL prefix, return as is
  if (url.startsWith('data:image/')) {
    return url;
  }

  // If it starts with just "data:" but is malformed
  if (url.startsWith('data:')) {
    // Extract the base64 part
    const parts = url.split(',');
    if (parts.length >= 2) {
      return `data:image/png;base64,${parts[1]}`;
    }
  }

  // If it's just a base64 string without data: prefix
  if (/^[A-Za-z0-9+/=]+$/.test(url)) {
    return `data:image/png;base64,${url}`;
  }

  // Default case, assume it's already properly formatted
  return url;
}

/**
 * Format an error result
 */
export function ImageGenerationError(error: string, prompt: string) {
  const header = formatHeader(`Image Generation Error`);
  const content = joinSections(
    header,
    `${formatBold('Error generating image for prompt:')} "${prompt}"`,
    `${formatBold('Error details:')} ${error}`,
  );

  return {
    type: 'image_generation_error',
    content,
  };
}
