'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { APIError, ErrorCode, LogCategory, logger } from 'agentdock-core';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

// Define interface for errors with code property
interface ExtendedError extends Error {
  code?: string;
}

export function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner />
      <span className="ml-2 text-sm text-gray-500">Loading chat...</span>
    </div>
  );
}

export function ChatError({
  error,
  onRetry,
  isOverlay = false
}: {
  error: Error;
  onRetry: () => void;
  isOverlay?: boolean;
}) {
  const router = useRouter();

  // Cast error to ExtendedError to access code property safely
  const extendedError = error as ExtendedError;

  React.useEffect(() => {
    logger.error(LogCategory.API, 'ChatContainer', 'Chat error occurred', {
      error: error.message,
      errorCode: extendedError.code
    });
  }, [error, extendedError.code]);

  // Enhanced error type checking with safe code access
  const errorCode = extendedError.code;

  // Extract a clean, user-friendly error message
  const getUserFriendlyMessage = () => {
    // For API key errors, provide a clear message
    if (isMissingApiKey) {
      return 'You need to provide an API key to use this agent. Please add your API key in settings.';
    }

    // For rate limit errors
    if (isRateLimitError) {
      return "You've reached the rate limit for this API. Please wait a moment before trying again.";
    }

    // For service unavailable errors
    if (isServiceUnavailableError) {
      return 'The AI service is currently unavailable. Please try again later.';
    }

    // For connection errors
    if (isConnectionError) {
      return 'Connection lost. Please check your internet connection and try again.';
    }

    // Try to clean up the error message if it contains JSON or technical details
    let cleanMessage = error.message;

    // Remove any JSON
    if (cleanMessage.includes('{') && cleanMessage.includes('}')) {
      // Try to extract just the main error message
      const jsonMatch = cleanMessage.match(/"error":"([^"]+)"/);
      if (jsonMatch && jsonMatch[1]) {
        cleanMessage = jsonMatch[1];
      } else {
        // If we can't extract nicely, just show a generic message
        cleanMessage = 'An error occurred while processing your request.';
      }
    }

    // Remove any stack traces or technical paths
    if (cleanMessage.includes('at ') && cleanMessage.includes('.js:')) {
      cleanMessage = cleanMessage.split('\n')[0];
    }

    return cleanMessage;
  };

  // Check for specific error types
  const isMissingApiKey =
    (error instanceof APIError && error.code === ErrorCode.LLM_API_KEY) ||
    errorCode === 'LLM_API_KEY_ERROR' ||
    error.message.toLowerCase().includes('api key') ||
    error.message.toLowerCase().includes('bring your own keys mode');

  const isConnectionError =
    error instanceof Error &&
    (error.message.includes('ECONNRESET') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network error'));

  const isRateLimitError =
    (error instanceof APIError && error.code === ErrorCode.LLM_RATE_LIMIT) ||
    errorCode === 'LLM_RATE_LIMIT_ERROR' ||
    error.message.toLowerCase().includes('rate limit');

  const isServiceUnavailableError =
    (error instanceof APIError &&
      error.code === ErrorCode.SERVICE_UNAVAILABLE) ||
    errorCode === 'SERVICE_UNAVAILABLE' ||
    error.message.toLowerCase().includes('service unavailable') ||
    error.message.toLowerCase().includes('server error');

  // Get appropriate action content based on error type
  const getActionContent = () => {
    if (isMissingApiKey) {
      return (
        <>
          <Button
            onClick={() => router.push('/settings')}
            className="w-full sm:w-auto"
          >
            Go to Settings
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Environment variables should be named like ANTHROPIC_API_KEY,
            OPENAI_API_KEY, etc.
          </p>
        </>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={onRetry}
          variant="default"
          className="w-full sm:w-auto"
        >
          Try Again
        </Button>

        {isConnectionError && (
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Reload Page
          </Button>
        )}
      </div>
    );
  };

  const friendlyMessage = getUserFriendlyMessage();

  // Get the appropriate error title
  const errorTitle = isMissingApiKey
    ? 'API Key Required'
    : isRateLimitError
      ? 'Rate Limit Exceeded'
      : isServiceUnavailableError
        ? 'Service Unavailable'
        : isConnectionError
          ? 'Connection Error'
          : 'Error';

  return (
    <div
      className={cn(
        'flex items-center justify-center p-4',
        isOverlay
          ? 'absolute inset-0 z-50 bg-background/80 backdrop-blur-sm'
          : 'h-full'
      )}
    >
      <Card className="max-w-md w-full shadow-lg border border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-destructive gap-3">
            <AlertCircle className="h-6 w-6" />
            <span className="text-lg font-semibold">{errorTitle}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          <p className="text-sm text-card-foreground leading-relaxed">
            {friendlyMessage}
          </p>

          {process.env.NODE_ENV === 'development' && errorCode && (
            <p className="text-xs text-muted-foreground mt-4 pt-2 border-t">
              Error code: {errorCode}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex-col items-start pt-4">
          {getActionContent()}
        </CardFooter>
      </Card>
    </div>
  );
}
