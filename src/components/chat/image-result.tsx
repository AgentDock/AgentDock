'use client';

import React, { useState } from 'react';
import {
  AlertOctagonIcon,
  DownloadIcon,
  ImageIcon,
  PencilLine
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageResultProps {
  imageData: any;
  prompt?: string;
  description?: string | null;
}

export function ImageResultDisplay({
  imageData,
  prompt,
  description
}: ImageResultProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Handle different image data formats (string URL or object with url/src)
  const imageUrl =
    typeof imageData === 'string'
      ? imageData
      : imageData?.url
        ? imageData.url
        : imageData?.src
          ? imageData.src
          : null;

  // Check for valid image URL
  React.useEffect(() => {
    if (!imageUrl) {
      setHasError(true);
    }
  }, [imageUrl]);

  // Convert relative URLs to absolute URLs if needed
  const ensureAbsoluteUrl = (url: string) => {
    if (typeof window !== 'undefined' && url && url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    return url;
  };

  // Navigate to image generation page with the image preloaded
  const handleNavigateToEdit = () => {
    if (imageUrl) {
      sessionStorage.setItem('editImageUrl', ensureAbsoluteUrl(imageUrl));
      window.location.href = '/image-generation';
    }
  };

  // Download image
  const downloadImage = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = ensureAbsoluteUrl(imageUrl);
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border bg-background">
      {/* Header section with prompt details */}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon
            className="h-4 w-4 text-primary"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold">Image Generation</span>
        </div>

        {prompt && (
          <div className="mb-2">
            <div className="text-xs font-medium text-accent-foreground">
              Prompt
            </div>
            <div className="text-sm text-muted-foreground">{prompt}</div>
          </div>
        )}

        {description && (
          <div className="mb-2">
            <div className="text-xs font-medium text-accent-foreground">
              Description
            </div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        )}
      </div>

      {/* Image display section */}
      {!hasError && imageUrl && (
        <div className="relative bg-muted/50 p-2">
          <img
            src={ensureAbsoluteUrl(imageUrl)}
            alt={'Generated image for: ' + (prompt || 'unknown prompt')}
            className={cn(
              'mx-auto max-w-full rounded-md transition-opacity duration-700',
              'min-h-[250px] min-w-[250px] max-h-[80vh] object-contain',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />

          {/* Loading spinner */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          )}

          {/* Action buttons */}
          <div
            className={cn(
              'absolute right-3 top-3 flex space-x-2 transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-md"
              onClick={handleNavigateToEdit}
              title="Edit in Image Generation Page"
              aria-label="Edit in Image Generation Page"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-md"
              onClick={downloadImage}
              title="Download Image"
              aria-label="Download Image"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="flex aspect-video items-center justify-center bg-muted/50 p-6">
          <div className="flex flex-col items-center justify-center space-y-3 px-4 text-center">
            <AlertOctagonIcon
              className="h-6 w-6 text-destructive"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Failed to load image
            </p>
            {imageUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(ensureAbsoluteUrl(imageUrl), '_blank')
                }
                className="mt-1"
              >
                Try Opening in New Tab
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
