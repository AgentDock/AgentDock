"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImageUpload } from "./components/ImageUpload";
import { ImagePromptInput } from "./components/ImagePromptInput";
import { ImageResultDisplay } from "./components/ImageResultDisplay";
import { ImageIcon, Wand2, Edit, PencilLine, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateImageAction } from "@/app/api/images/gemini/actions";
import { listStoredImages, getStoredImage, getImageDataFromUrl, isImageStoreUrl } from "@/lib/image-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ImageGallerySkeleton } from "./components/ImageGallerySkeleton";

interface HistoryItem {
  role: "user" | "model";
  parts: HistoryPart[];
}

interface HistoryPart {
  text?: string;
  image?: string;
}

// SearchParams wrapper component to fix hydration issues
function ImageGenerationWithParams(props: { editIdFromUrl?: string | null }) {
  const { editIdFromUrl } = props;
  
  const [image, setImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storedImages, setStoredImages] = useState<string[]>([]);
  const [scrollToGallery, setScrollToGallery] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(true);
  
  const router = useRouter();
  
  // Effect to load stored images on mount
  useEffect(() => {
    const fetchStoredImages = async () => {
      setGalleryLoading(true);
      try {
        const response = await fetch('/api/images/store/debug');
        if (response.ok) {
          const data = await response.json();
          setStoredImages(data.images.map((img: any) => img.id));
        }
      } catch (error) {
        console.error("Failed to fetch stored images:", error);
      } finally {
        setGalleryLoading(false);
      }
    };
    
    fetchStoredImages();
    
    // Check if there's an image to edit from the chat page
    if (typeof window !== 'undefined') {
      const editImageUrl = sessionStorage.getItem('editImageUrl');
      if (editImageUrl) {
        // Load the image
        const loadImageFromChat = async () => {
          try {
            setLoading(true);
            const imageData = await getImageDataFromUrl(editImageUrl);
            if (imageData) {
              setImage(imageData);
              sessionStorage.removeItem('editImageUrl'); // Clear the storage after using it
            }
          } catch (error) {
            console.error("Error loading image from chat:", error);
            setError("Failed to load the image from chat.");
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
          console.error("Error selecting image from URL:", error);
          setError("Failed to load the requested image for editing.");
        } finally {
          setLoading(false);
        }
      }
    };
    
    checkForImageToEdit();
  }, [editIdFromUrl]);

  // Helper function to get image data from URL
  const getImageDataFromUrl = async (url: string): Promise<string | null> => {
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
      console.error("Error fetching image data:", error);
      return null;
    }
  };

  const handleImageSelect = (imageData: string) => {
    setImage(imageData);
    setGeneratedImage(null);
  };

  const handleGalleryImageSelect = async (imageId: string) => {
    try {
      const imageUrl = `/api/images/store/${imageId}`;
      const imageData = await getImageDataFromUrl(imageUrl);
      
      if (imageData) {
        setImage(imageData);
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
        throw new Error("Failed to load image data");
      }
    } catch (error) {
      console.error("Error selecting gallery image:", error);
      setError("Failed to load the selected image for editing.");
    }
  };

  const handlePromptSubmit = async (prompt: string) => {
    if (!prompt.trim() && !image) {
      setError("Please provide a prompt or upload an image.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the current origin for absolute URLs
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      
      // Use a copy of the image variable
      let imageToEdit = image;
      
      // If image is a URL from the image store, fetch the actual data
      if (imageToEdit && (isImageStoreUrl(imageToEdit) || imageToEdit.includes('/api/images/store/'))) {
        console.log("Image is a URL, fetching actual image data...");
        
        try {
          const imageData = await getImageDataFromUrl(imageToEdit);
          if (imageData) {
            console.log("Successfully retrieved image data");
            imageToEdit = imageData;
          } else {
            console.error("Failed to get image data from URL");
            setError("Failed to process the image for editing. Please try again.");
            setLoading(false);
            return;
          }
        } catch (fetchError) {
          console.error("Error fetching image data:", fetchError);
          setError("Failed to retrieve the image data for editing. Please try again.");
          setLoading(false);
          return;
        }
      }

      // Use the Server Action with origin to ensure consistent URL format
      try {
        const result = await generateImageAction(prompt, imageToEdit || undefined, origin);

        if (result.image) {
          // Ensure we have an absolute URL
          const absoluteImageUrl = result.image.startsWith('http') 
            ? result.image 
            : `${origin}${result.image.startsWith('/') ? '' : '/'}${result.image}`;
          
          // Update the generated image and description
          setGeneratedImage(absoluteImageUrl);
          setDescription(result.description || null);

          // Update history locally - add user message
          const userMessage: HistoryItem = {
            role: "user",
            parts: [
              { text: prompt },
              ...(imageToEdit ? [{ image: imageToEdit }] : []),
            ],
          };

          // Add AI response
          const aiResponse: HistoryItem = {
            role: "model",
            parts: [
              ...(result.description ? [{ text: result.description }] : []),
              { image: absoluteImageUrl },
            ],
          };

          // Update history with both messages
          setHistory((prevHistory) => [...prevHistory, userMessage, aiResponse]);
          
          // Refresh the list of stored images
          setGalleryLoading(true);
          try {
            const response = await fetch('/api/images/store/debug');
            if (response.ok) {
              const data = await response.json();
              setStoredImages(data.images.map((img: any) => img.id));
            }
          } catch (error) {
            console.error("Failed to fetch stored images:", error);
          } finally {
            setGalleryLoading(false);
          }
        } else {
          setError("No image returned from API");
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "API error");
        console.error("Error processing request:", error);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Error processing request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setGeneratedImage(null);
    setDescription(null);
    setLoading(false);
    setError(null);
    // Don't reset conversation history
  };

  // If we have a generated image, we want to edit it next time
  const currentImage = generatedImage || image;
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
      console.error("Failed to fetch stored images:", error);
    } finally {
      setGalleryLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex flex-col items-center text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">Image Generation</h1>
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
                  imageUrl={displayImage || ""}
                  description={description}
                  onReset={handleReset}
                  conversationHistory={history}
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
      <div id="image-gallery" className="mt-16 scroll-mt-4 max-w-7xl mx-auto">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshGallery}
            disabled={galleryLoading}
            className="border-primary/20 hover:bg-primary/5 hover:text-primary shadow-sm"
          >
            {galleryLoading ? "Refreshing..." : "Refresh Gallery"}
          </Button>
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
            {storedImages.map((imageId) => (
              <div 
                key={imageId} 
                className="overflow-hidden group relative rounded-xl border border-muted bg-gradient-to-br from-card to-muted/30 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="aspect-square relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
                  <img 
                    src={`/api/images/store/${imageId}`} 
                    alt={`Generated image`}
                    className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4 z-20">
                    <div className="flex-1">
                      <p className="text-xs text-white/90 font-medium flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {new Date(parseInt(imageId.split('_')[1])).toLocaleString(undefined, { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 rounded-lg bg-white/90 text-black hover:bg-white/100 shadow-md transition-transform hover:scale-105"
                              onClick={() => handleGalleryImageSelect(imageId)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit this image</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={`/api/images/store/${imageId}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={cn(
                                "inline-flex items-center justify-center h-8 w-8 rounded-lg",
                                "bg-white/90 text-black hover:bg-white/100 shadow-md transition-transform hover:scale-105",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                "focus-visible:ring-ring transition-colors"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main component that safely uses searchParams
export default function ImageGenerationPage() {
  return (
    <Suspense fallback={<div className="p-12 flex justify-center">
      <div className="animate-spin mr-2">
        <ImageIcon className="h-6 w-6 text-primary" />
      </div>
      <span>Loading image editor...</span>
    </div>}>
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