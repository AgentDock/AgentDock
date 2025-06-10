'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LogCategory, logger } from 'agentdock-core';
import { ChevronUp, ImageIcon, PencilLine, Trash2 } from 'lucide-react';

import { generateImageAction } from '@/app/api/images/gemini/actions';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { HistoryItem } from '@/lib/image-gen-storage';
import { cn } from '@/lib/utils';
import { ImageGallerySkeleton } from './components/ImageGallerySkeleton';
import { ImagePromptInput } from './components/ImagePromptInput';
import { ImageResultDisplay } from './components/ImageResultDisplay';
import { ImageUpload } from './components/ImageUpload';
import { clearHistoryAction, saveHistoryAction } from './history-actions';

// Helper function to get image data from URL
const fetchImageDataFromUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image data:', error);
    return null;
  }
};

// SearchParams wrapper component to fix hydration issues
function ImageGenerationWithParams(props: { editIdFromUrl?: string | null }) {
  const { editIdFromUrl } = props;

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [storedImages, setStoredImages] = useState<string[]>([]);
  const [scrollToGallery, setScrollToGallery] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Effect to manage session ID ONLY
  useEffect(() => {
    let storedSessionId = localStorage.getItem('imageGenSessionId');
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem('imageGenSessionId', storedSessionId);
      logger.debug(
        LogCategory.SYSTEM,
        'ImageGenPage',
        'Generated new imageGenSessionId',
        { sessionId: storedSessionId }
      );
    } else {
      logger.debug(
        LogCategory.SYSTEM,
        'ImageGenPage',
        'Retrieved existing imageGenSessionId',
        { sessionId: storedSessionId }
      );
    }
    setSessionId(storedSessionId);
  }, []);

  // Effect to load stored images on mount (environment-aware)
  useEffect(() => {
    const IS_HUB_CLIENT = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'hub';
    logger.debug(LogCategory.SYSTEM, 'ImageGenPage', 'Loading gallery images', {
      isHub: IS_HUB_CLIENT
    });

    setGalleryLoading(true);
    if (IS_HUB_CLIENT) {
      // --- Production/Hub Mode ---
      const storedUrls = localStorage.getItem('galleryImageUrls');
      if (storedUrls) {
        try {
          const urls = JSON.parse(storedUrls);
          setStoredImages(urls);
          logger.debug(
            LogCategory.SYSTEM,
            'ImageGenPage',
            'Loaded gallery URLs from localStorage',
            { count: urls.length }
          );
        } catch (e) {
          logger.error(
            LogCategory.SYSTEM,
            'ImageGenPage',
            'Failed to parse gallery URLs from localStorage',
            { error: e }
          );
          localStorage.removeItem('galleryImageUrls');
          setStoredImages([]);
        }
      } else {
        setStoredImages([]); // Start empty if nothing in localStorage
      }
      setGalleryLoading(false);
    } else {
      // --- Local/OSS Mode ---
      // Clear any potentially stale localStorage from hub mode
      localStorage.removeItem('galleryImageUrls');

      const fetchStoredImagePaths = async () => {
        try {
          const response = await fetch('/api/images/store/debug');
          if (response.ok) {
            const data = await response.json();
            const imagePaths = data.images.map(
              (img: any) => `/api/images/store/${img.id}`
            );
            setStoredImages(imagePaths);
            logger.debug(
              LogCategory.SYSTEM,
              'ImageGenPage',
              'Loaded gallery paths from API',
              { count: imagePaths.length }
            );
          } else {
            logger.warn(
              LogCategory.SYSTEM,
              'ImageGenPage',
              'Failed to fetch gallery IDs from API',
              { status: response.status }
            );
            setStoredImages([]);
          }
        } catch (error) {
          console.error('Failed to fetch stored images:', error);
          setStoredImages([]);
        } finally {
          setGalleryLoading(false);
        }
      };
      fetchStoredImagePaths();
    }

    // Check if there's an image to edit from the chat page
    if (typeof window !== 'undefined') {
      const editImageUrl = sessionStorage.getItem('editImageUrl');
      if (editImageUrl) {
        // Load the image
        const loadImageFromChat = async () => {
          try {
            setLoading(true);
            const imageData = await fetchImageDataFromUrl(editImageUrl);
            if (imageData) {
              setUploadedImage(imageData);
              sessionStorage.removeItem('editImageUrl'); // Clear the storage after using it
            }
          } catch (error) {
            console.error('Error loading image from chat:', error);
            setError('Failed to load the image from chat.');
          } finally {
            setLoading(false);
          }
        };

        loadImageFromChat();
      }
    }
  }, []);

  // Effect to scroll to gallery if requested
  useEffect(() => {
    if (scrollToGallery) {
      const galleryElement = document.getElementById('image-gallery');
      if (galleryElement) {
        galleryElement.scrollIntoView({ behavior: 'smooth' });
      }
      setScrollToGallery(false);
    }
  }, [scrollToGallery]);

  // Effect to check for image edit query param
  useEffect(() => {
    const checkForImageToEdit = async () => {
      if (editIdFromUrl) {
        try {
          setLoading(true);
          await handleGalleryImageSelect(editIdFromUrl);
        } catch (error) {
          console.error('Error selecting image from URL:', error);
          setError('Failed to load the requested image for editing.');
        } finally {
          setLoading(false);
        }
      }
    };

    checkForImageToEdit();
  }, [editIdFromUrl]);

  const handleImageSelect = (imageData: string) => {
    setUploadedImage(imageData);
    setGeneratedImage(null);
  };

  const handleGalleryImageSelect = async (imageId: string) => {
    try {
      const imageUrl = `/api/images/store/${imageId}`;
      const imageData = await fetchImageDataFromUrl(imageUrl);

      if (imageData) {
        setUploadedImage(imageData);
        setGeneratedImage(null);
        setDescription(null);

        // Update URL to reflect the edit state without refreshing the page
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('edit', imageId);
          window.history.pushState({}, '', url.toString());
        }

        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('Failed to load image data');
      }
    } catch (error) {
      console.error('Error selecting gallery image:', error);
      setError('Failed to load the selected image for editing.');
    }
  };

  const handlePromptSubmit = async (promptText: string) => {
    if (!promptText.trim() && !uploadedImage) {
      setError('Please provide a prompt or upload an image.');
      return;
    }

    if (!sessionId) {
      setError('Session not available. Please try reloading.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const userPromptItem: HistoryItem = {
      role: 'user',
      parts: [{ text: promptText }]
    };
    const optimisticHistory = [...historyItems, userPromptItem];
    setHistoryItems(optimisticHistory);

    try {
      const result = await generateImageAction(
        promptText,
        uploadedImage || undefined
      );

      if (result?.image) {
        setGeneratedImage(result.image);

        const newHistoryItem: HistoryItem = {
          role: 'model',
          parts: [{ image: result.image }]
        };
        const finalHistory = [...optimisticHistory, newHistoryItem];
        setHistoryItems(finalHistory);

        logger.debug(
          LogCategory.SYSTEM,
          'ImageGenPage',
          'History before saving via action:',
          { finalHistory }
        );

        // Save the complete history using Server Action
        await saveHistoryAction(sessionId, finalHistory);

        // --- Update Gallery Based on Environment ---
        const returnedImageUrl = result.image; // URL from action (Blob or local API path)

        if (returnedImageUrl.startsWith('http')) {
          // If it's a Blob URL ('hub')
          const currentUrls = JSON.parse(
            localStorage.getItem('galleryImageUrls') || '[]'
          );
          const updatedUrls = [...currentUrls, returnedImageUrl];
          localStorage.setItem('galleryImageUrls', JSON.stringify(updatedUrls));
          setStoredImages(updatedUrls); // Update state with the full list including the new URL
          logger.debug(
            LogCategory.SYSTEM,
            'ImageGenPage',
            'Updated localStorage gallery (hub)',
            { count: updatedUrls.length }
          );
        } else {
          // Local environment: returnedImageUrl is the relative path
          // Update state by adding the new path to the existing paths
          setStoredImages((prevPaths) => [...prevPaths, returnedImageUrl]);
          logger.debug(
            LogCategory.SYSTEM,
            'ImageGenPage',
            'Updated memory gallery (local)',
            { newPath: returnedImageUrl }
          );
          // No need to re-fetch, we already have the path
        }
        // ------------------------------------------
      } else {
        setHistoryItems(historyItems);
        setError('Image generation completed but returned no image.');
      }
    } catch (actionError) {
      setHistoryItems(historyItems);
      console.error('Error during image generation/saving:', actionError);
      const message =
        actionError instanceof Error
          ? actionError.message
          : 'Failed to generate/save history.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setGeneratedImage(null);
    setDescription(null);
    setLoading(false);
    setError(null);
    // Don't reset conversation history
  };

  // If we have a generated image, we want to edit it next time
  const currentImage = generatedImage || uploadedImage;
  const isEditing = !!currentImage;

  // Get the latest image to display (always the generated image)
  const displayImage = generatedImage;

  // Scroll to gallery button handler
  const handleScrollToGallery = () => {
    setScrollToGallery(true);
  };

  const handleRefreshGallery = async () => {
    setGalleryLoading(true);
    try {
      const response = await fetch('/api/images/store/debug');
      if (response.ok) {
        const data = await response.json();
        setStoredImages(data.images.map((img: any) => img.id));
      }
    } catch (error) {
      console.error('Failed to fetch stored images:', error);
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleClearHistory = useCallback(async () => {
    // Only proceed if in hub mode (button shouldn't be clickable otherwise, but double-check)
    if (!sessionId || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'hub') return;

    try {
      // 1. Clear persistent KV history via Server Action
      await clearHistoryAction(sessionId);

      // 2. Clear local UI state for history AND gallery
      setHistoryItems([]);
      setStoredImages([]);
      setError(null);
      setGeneratedImage(null);
      setDescription(null);
      setLoading(false);

      // 3. Clear relevant localStorage items
      localStorage.removeItem('galleryImageUrls'); // Clear gallery URLs
      localStorage.removeItem('imageGenSessionId'); // Clear session ID
      setSessionId(null); // Also reset the session ID state

      logger.info(
        LogCategory.SYSTEM,
        'ImageGenPage',
        'Cleared history, gallery state, and local session ID'
      );
    } catch (err) {
      console.error('Failed to clear history via action:', err);
      setError('Could not clear the generation history.');
    }
  }, [sessionId]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex flex-col items-center text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
          Image Generation
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Create and edit images with Gemini AI.
        </p>
      </div>

      <div className="relative mb-14 max-w-4xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-indigo-500/20 to-primary/20 rounded-2xl blur-lg opacity-70"></div>
        <div className="relative bg-card/95 backdrop-blur-sm border-0 rounded-xl shadow-xl overflow-hidden">
          <div className="p-8 space-y-8">
            {error && (
              <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                {error}
              </div>
            )}

            {!displayImage && !loading ? (
              <>
                <div className="space-y-6">
                  <ImageUpload
                    onImageSelect={handleImageSelect}
                    currentImage={currentImage}
                  />
                  <div className="pt-4">
                    <ImagePromptInput
                      onSubmit={handlePromptSubmit}
                      isEditing={isEditing}
                      isLoading={loading}
                    />
                  </div>

                  {storedImages.length > 0 && (
                    <div className="pt-2 flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleScrollToGallery}
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <span>Browse image gallery</span>
                        <ChevronUp className="h-3 w-3 rotate-180" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : loading ? (
              <div className="flex items-center justify-center h-80 rounded-lg bg-gradient-to-br from-primary/5 to-accent/10 animate-pulse">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-t-primary border-2 animate-spin"></div>
                    <ImageIcon className="w-8 h-8 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-foreground">
                      Creating your image...
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This may take a few moments
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <ImageResultDisplay
                  imageUrl={displayImage || ''}
                  description={description}
                  onReset={handleReset}
                  conversationHistory={historyItems}
                />
                <div className="border-t pt-6 mt-6">
                  <ImagePromptInput
                    onSubmit={handlePromptSubmit}
                    isEditing={true}
                    isLoading={loading}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stored Images in the Global Store */}
      <div
        id="image-gallery"
        className="mt-16 scroll-mt-4 max-w-7xl mx-auto"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <ImageIcon className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Gallery</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Browse and edit your images
            </p>
          </div>
          <div className="flex gap-2">
            {process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'hub' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearHistory}
                      // Disable if no session OR historyItems is empty (relevant in hub mode)
                      disabled={!sessionId || historyItems.length === 0}
                      className="border-destructive/20 hover:bg-destructive/10 hover:text-destructive shadow-sm text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Clear History & Session
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Clear generation history and reset session
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshGallery}
              disabled={galleryLoading}
              className="border-primary/20 hover:bg-primary/5 hover:text-primary shadow-sm text-xs"
            >
              {galleryLoading ? 'Refreshing...' : 'Refresh Gallery'}
            </Button>
          </div>
        </div>

        {galleryLoading ? (
          <ImageGallerySkeleton count={8} />
        ) : storedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-dashed border-muted-foreground/20">
            <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No images yet</p>
            <p className="text-sm text-muted-foreground/80 mt-1 max-w-md text-center">
              Create your first image with the tools above
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {storedImages.map((imageRef, index) => {
              // Determine type based on environment (for Edit button logic)
              const IS_HUB_CLIENT =
                process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'hub';
              // imageRef now always contains the correct src URL/path
              const imageUrl = imageRef;
              // Derive an ID for key and potentially Edit button (might need improvement)
              const imageId = IS_HUB_CLIENT
                ? imageUrl.split('/').pop()?.split('.')[0] || `blob-${index}`
                : imageUrl.split('/').pop() || `local-${index}`;

              return (
                <div
                  key={imageId}
                  className="overflow-hidden group relative rounded-xl border border-muted bg-gradient-to-br from-card to-muted/30 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
                    <img
                      src={imageUrl} // Always use imageUrl directly
                      alt={`Generated image ${imageId}`}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4 z-20">
                      <div className="flex-1">
                        {/* Attempt timestamp extraction - might fail for Blob URLs initially */}
                        {imageId.startsWith('img_') && (
                          <p className="text-xs text-white/90 font-medium flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                              ></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            {new Date(
                              parseInt(imageId.split('_')[1])
                            ).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric'
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 rounded-lg bg-white/90 text-black hover:bg-white/100 shadow-md transition-transform hover:scale-105"
                                // Edit button needs careful handling in hub mode
                                // We need the *local* API ID equivalent if possible,
                                // or adjust handleGalleryImageSelect to work with Blob URLs?
                                // For now, disable editing from gallery in hub mode?
                                onClick={() =>
                                  !IS_HUB_CLIENT &&
                                  handleGalleryImageSelect(imageId)
                                }
                                disabled={IS_HUB_CLIENT} // Disable edit from gallery in Hub mode for now
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {IS_HUB_CLIENT
                                  ? 'Editing from gallery disabled in Hub mode'
                                  : 'Edit this image'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={imageUrl} // Link directly to Blob URL or local API URL
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'inline-flex items-center justify-center h-8 w-8 rounded-lg',
                                  'bg-white/90 text-black hover:bg-white/100 shadow-md transition-transform hover:scale-105',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                                  'focus-visible:ring-ring transition-colors'
                                )}
                              >
                                <ImageIcon className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View full size</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Main component that safely uses searchParams
export default function ImageGenerationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center">
          <div className="animate-spin mr-2">
            <ImageIcon className="h-6 w-6 text-primary" />
          </div>
          <span>Loading image editor...</span>
        </div>
      }
    >
      <SearchParamsWrapper />
    </Suspense>
  );
}

// Separate component for handling searchParams to avoid hydration issues
function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams?.get('edit');

  return <ImageGenerationWithParams editIdFromUrl={editIdFromUrl} />;
}
