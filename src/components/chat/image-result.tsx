"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DownloadIcon, ImageIcon, PencilLine, AlertOctagonIcon } from "lucide-react"

interface ImageResultProps {
  imageData: any
  prompt?: string
  description?: string | null
}

export function ImageResultDisplay({ imageData, prompt, description }: ImageResultProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  // Handle the new format where imageData might be a string URL or an object with url/src
  const imageUrl = typeof imageData === 'string' ? imageData : 
                  imageData?.url ? imageData.url : 
                  imageData?.src ? imageData.src : null
  
  // If we don't have a valid URL, show an error
  React.useEffect(() => {
    if (!imageUrl) {
      setHasError(true)
    }
  }, [imageUrl])

  // Convert relative URLs to absolute URLs if needed
  const ensureAbsoluteUrl = (url: string) => {
    if (typeof window !== 'undefined' && url && url.startsWith('/')) {
      return `${window.location.origin}${url}`
    }
    return url
  }
  
  // Navigate to image generation page with the image preloaded
  const handleNavigateToEdit = () => {
    if (imageUrl) {
      // Store the image URL in sessionStorage for the dedicated page to use
      sessionStorage.setItem('editImageUrl', ensureAbsoluteUrl(imageUrl))
      // Navigate to the dedicated image generation page
      window.location.href = '/image-generation'
    }
  }
  
  // Download an image from a data URL
  const downloadImage = () => {
    if (imageUrl) {
      const link = document.createElement("a")
      link.href = ensureAbsoluteUrl(imageUrl)
      link.download = `image-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
  
  return (
    <div className="my-2 overflow-hidden rounded-md border bg-background">
      <div className="p-3">
        <div className="mb-2 flex items-center space-x-2">
          <ImageIcon className="h-4 w-4" />
          <span className="text-xs font-semibold">Image Generation</span>
        </div>
        {prompt && (
          <div className="mb-2">
            <div className="text-xs font-medium text-accent-foreground">Prompt</div>
            <div className="text-sm text-muted-foreground">{prompt}</div>
          </div>
        )}
        {description && (
          <div className="mb-2">
            <div className="text-xs font-medium text-accent-foreground">Description</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        )}
      </div>
      {!hasError && imageUrl && (
        <div className="relative bg-muted/50 p-2">
          <img
            src={ensureAbsoluteUrl(imageUrl)}
            alt={"Generated image for: " + (prompt || "unknown prompt")}
            className={cn(
              "mx-auto max-w-full rounded-md transition-opacity duration-700",
              !isLoaded ? "opacity-0" : "opacity-100"
            )}
            style={{ 
              maxHeight: "80vh",
              minWidth: "250px",
              minHeight: "250px",
              objectFit: "contain"
            }}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          )}
          <div className={cn(
            "absolute right-3 top-3 flex space-x-2 opacity-0 transition-opacity",
            isLoaded && "opacity-100"
          )}>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-md"
              onClick={handleNavigateToEdit}
              title="Edit in Image Generation Page"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-md"
              onClick={downloadImage}
              title="Download Image"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {hasError && (
        <div className="flex aspect-[16/10] items-center justify-center bg-muted/50 sm:aspect-[2/1]">
          <div className="flex flex-col items-center justify-center space-y-2 px-4 text-center">
            <AlertOctagonIcon className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load image</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                // Attempt to open the image in a new tab even if it failed to load in the component
                if (imageUrl) {
                  window.open(ensureAbsoluteUrl(imageUrl), '_blank')
                }
              }}
            >
              Try Opening in New Tab
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 