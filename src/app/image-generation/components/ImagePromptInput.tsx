'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wand2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ImagePromptInputProps {
  onSubmit: (prompt: string) => void;
  isEditing: boolean;
  isLoading: boolean;
}

export function ImagePromptInput({ onSubmit, isEditing, isLoading }: ImagePromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      // Don't clear prompt for editing workflows
      if (!isEditing) {
        setPrompt('');
      }
    }
  };

  // Example prompts for simpler concepts that work better
  const getPlaceholder = () => {
    if (isEditing) {
      return 'Example: Change the background to a beach scene and add a sunset...';
    } else {
      return 'Example: A cartoon tiger wearing sunglasses on a tropical beach...';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            {isEditing ? (
              <Wand2 className="h-4 w-4 text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
          </div>
          <label htmlFor="prompt" className="block text-base font-medium">
            {isEditing ? 'Edit your image' : 'Describe what you want to generate'}
          </label>
        </div>

        <div className="relative">
          <Textarea
            id="prompt"
            className={cn(
              'min-h-[120px] resize-none transition-all p-4 pr-8',
              'focus-visible:ring-primary/70 focus-visible:ring-offset-0',
              'border-primary/20 bg-gradient-to-b from-card/80 to-card',
              'placeholder:text-muted-foreground/80 rounded-xl shadow-sm',
            )}
            placeholder={getPlaceholder()}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <div className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary/70">
              {prompt.length} chars
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className={cn(
            'w-full gap-2 transition-all h-12 rounded-xl',
            'bg-gradient-to-r from-primary to-primary/90 hover:opacity-90',
            'font-medium text-white shadow-md',
            isLoading && 'animate-pulse',
          )}
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
              <span>Processing your request...</span>
            </>
          ) : (
            <>
              {isEditing ? <Wand2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              <span>{isEditing ? 'Edit Image' : 'Generate Image'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
