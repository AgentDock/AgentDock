'use client';

import { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  ImageIcon,
  MessageCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HistoryItem {
  role: 'user' | 'model';
  parts: HistoryPart[];
}

interface HistoryPart {
  text?: string;
  image?: string;
}

interface ImageResultDisplayProps {
  imageUrl: string;
  description: string | null;
  onReset: () => void;
  conversationHistory?: HistoryItem[];
}

export function ImageResultDisplay({
  imageUrl,
  description,
  onReset,
  conversationHistory = []
}: ImageResultDisplayProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Ensure we have an absolute URL for images
  const ensureAbsoluteUrl = (url: string) => {
    if (typeof window !== 'undefined' && url && url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    return url;
  };

  // Reset image states when URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [imageUrl]);

  const absoluteImageUrl = ensureAbsoluteUrl(imageUrl);

  const handleDownload = () => {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = absoluteImageUrl;
    link.download = `agentdock-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Generated Image</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(absoluteImageUrl, '_blank')}
            className="border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Full Size
          </Button>
          {conversationHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleHistory}
              className={cn(
                'border-primary/20 hover:bg-primary/5',
                showHistory
                  ? 'bg-primary/10 text-primary'
                  : 'hover:text-primary'
              )}
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              {showHistory ? 'Hide History' : 'History'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="border-primary/20 hover:bg-destructive/10 hover:text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            New Image
          </Button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted/80 p-1 shadow-inner">
        <div className="rounded-lg overflow-hidden bg-black/5 backdrop-blur-sm relative">
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center h-80 bg-gradient-to-br from-card to-black/5">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                  <ImageIcon className="w-5 h-5 text-primary/70" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Loading image...
                </p>
              </div>
            </div>
          )}

          {imageError && (
            <div className="flex flex-col items-center justify-center h-80 bg-muted/20 text-muted-foreground">
              <div className="p-4 rounded-lg bg-card/80 backdrop-blur-sm border border-destructive/20 shadow-sm">
                <p className="mb-3 text-sm font-medium text-destructive/80">
                  Failed to load image
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(absoluteImageUrl, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Try Opening Directly
                </Button>
              </div>
            </div>
          )}

          <img
            src={absoluteImageUrl}
            alt="Generated image"
            className={`max-w-full h-auto mx-auto transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ maxHeight: '60vh' }}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.error(`Failed to load image: ${absoluteImageUrl}`);
              setImageError(true);
            }}
          />
        </div>
      </div>

      {description && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-background border border-primary/10">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span className="inline-block p-1 bg-primary/10 rounded">
              <MessageCircle className="w-3 h-3 text-primary" />
            </span>
            Description
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {showHistory && conversationHistory.length > 0 && (
        <div className="p-5 rounded-xl bg-muted/30 border border-muted">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <span className="inline-block p-1 bg-primary/10 rounded">
              <MessageCircle className="w-3 h-3 text-primary" />
            </span>
            Image History
          </h3>
          <div className="space-y-4">
            {conversationHistory.map((item, index) => (
              <div
                key={index}
                className={cn(
                  'p-4 rounded-lg',
                  item.role === 'user'
                    ? 'bg-muted border border-muted-foreground/20'
                    : 'bg-primary/5 border border-primary/20'
                )}
              >
                <p
                  className={`text-sm font-medium mb-2 ${
                    item.role === 'user' ? 'text-foreground' : 'text-primary'
                  }`}
                >
                  {item.role === 'user' ? 'Your Request' : 'Generated Result'}
                </p>
                <div className="space-y-3">
                  {item.parts.map((part, partIndex) => (
                    <div key={partIndex}>
                      {part.text && <p className="text-sm">{part.text}</p>}
                      {part.image && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-muted-foreground/10 shadow-sm">
                          <img
                            src={ensureAbsoluteUrl(part.image)}
                            alt={`${item.role} image`}
                            className="max-w-full h-auto object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
