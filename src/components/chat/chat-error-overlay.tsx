'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { APIError, ErrorCode, LogCategory, logger } from 'agentdock-core';
import { AlertCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// Define interface for errors with code property
interface ExtendedError extends Error {
  code?: string;
}

interface ChatErrorOverlayProps {
  error: Error;
  onRetry: () => void;
  onDismiss?: () => void;
  open: boolean;
  agentId?: string;
}

// Error categories for more consistent handling
enum ErrorCategory {
  Security = 'security',
  Network = 'network',
  Validation = 'validation',
  Storage = 'storage',
  Unknown = 'unknown',
  LLM = 'llm'
}

// Error config for UI presentation
interface ErrorConfig {
  title: string;
  message: string;
  actions: 'settings' | 'retry' | 'default';
}

export function ChatErrorOverlay({
  error,
  onRetry,
  onDismiss,
  open
}: ChatErrorOverlayProps) {
  const router = useRouter();
  const extendedError = error as ExtendedError;

  // Log error when overlay opens
  React.useEffect(() => {
    if (open) {
      logger.error(LogCategory.API, 'ChatContainer', 'Chat error occurred', {
        error: error.message,
        errorCode: extendedError.code
      });
    }
  }, [error, extendedError.code, open]);

  // Get error configuration based on type
  const errorCategory = getErrorCategory(error, extendedError.code);
  const errorConfig = getErrorConfig(errorCategory, error);

  if (!open) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={onDismiss ? () => onDismiss() : undefined}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle
              className="h-5 w-5"
              aria-hidden="true"
            />
            <span>{errorConfig.title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {errorConfig.message}
          </AlertDialogDescription>
          {process.env.NODE_ENV === 'development' && extendedError.code && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              Error code:{' '}
              <code className="font-mono">{extendedError.code}</code>
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {errorConfig.actions === 'settings' ? (
            <>
              <Button
                onClick={() => router.push('/settings')}
                variant="default"
                className="w-full sm:w-auto"
              >
                Go to Settings
              </Button>
              <AlertDialogCancel className="mt-2 sm:mt-0">
                Dismiss
              </AlertDialogCancel>
            </>
          ) : (
            <>
              <Button
                onClick={onRetry}
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <AlertDialogCancel className="mt-2 sm:mt-0">
                Dismiss
              </AlertDialogCancel>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Consolidated error category detection function
function getErrorCategory(error: Error, errorCode?: string): ErrorCategory {
  // API key errors
  if (
    (error instanceof APIError && error.code === ErrorCode.LLM_API_KEY) ||
    errorCode === 'LLM_API_KEY_ERROR' ||
    error.message.toLowerCase().includes('api key') ||
    error.message.toLowerCase().includes('bring your own keys mode')
  ) {
    return ErrorCategory.Security;
  }

  // Rate limit errors
  if (
    (error instanceof APIError && error.code === ErrorCode.LLM_RATE_LIMIT) ||
    errorCode === 'LLM_RATE_LIMIT_ERROR' ||
    error.message.toLowerCase().includes('rate limit')
  ) {
    return ErrorCategory.Network;
  }

  // Service unavailable errors
  if (
    (error instanceof APIError &&
      error.code === ErrorCode.SERVICE_UNAVAILABLE) ||
    errorCode === 'SERVICE_UNAVAILABLE' ||
    error.message.toLowerCase().includes('service unavailable') ||
    error.message.toLowerCase().includes('server error')
  ) {
    return ErrorCategory.Network;
  }

  // LLM execution errors
  if (
    (error instanceof APIError && error.code === ErrorCode.LLM_EXECUTION) ||
    errorCode === 'LLM_EXECUTION_ERROR'
  ) {
    return ErrorCategory.LLM;
  }

  // Connection errors
  if (
    error.message.includes('ECONNRESET') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('Network error')
  ) {
    return ErrorCategory.Network;
  }

  return ErrorCategory.Unknown;
}

// Clean error message for display
function getCleanErrorMessage(error: Error): string {
  let cleanMessage = error.message;

  // Remove JSON content
  if (cleanMessage.includes('{') && cleanMessage.includes('}')) {
    const jsonMatch = cleanMessage.match(/"error":"([^"]+)"/);
    if (jsonMatch && jsonMatch[1]) {
      cleanMessage = jsonMatch[1];
    } else {
      cleanMessage = 'An error occurred while processing your request.';
    }
  }

  // Remove stack traces
  if (cleanMessage.includes('at ') && cleanMessage.includes('.js:')) {
    cleanMessage = cleanMessage.split('\n')[0];
  }

  return cleanMessage;
}

// Get error display configuration
function getErrorConfig(
  errorCategory: ErrorCategory,
  error: Error
): ErrorConfig {
  switch (errorCategory) {
    case ErrorCategory.Security:
      return {
        title: 'API Key Required',
        message:
          'This agent requires an API key to function. Please go to the Settings page to configure your API keys, then return to try again.',
        actions: 'settings'
      };
    case ErrorCategory.Network:
      if (error.message.toLowerCase().includes('rate limit')) {
        return {
          title: 'Rate Limit Exceeded',
          message:
            "You've reached the rate limit for this API. Please wait a moment before trying again.",
          actions: 'default'
        };
      } else if (
        error.message.toLowerCase().includes('service unavailable') ||
        error.message.toLowerCase().includes('server error')
      ) {
        return {
          title: 'Service Unavailable',
          message:
            'The AI service is currently unavailable. Please try again later.',
          actions: 'default'
        };
      } else {
        return {
          title: 'Connection Error',
          message:
            'Failed to connect to the AI service. Please check your internet connection and try again.',
          actions: 'retry'
        };
      }
    case ErrorCategory.Validation:
      return {
        title: 'Invalid Request',
        message: getCleanErrorMessage(error),
        actions: 'default'
      };
    case ErrorCategory.Storage:
      return {
        title: 'Storage Error',
        message:
          'Failed to access local storage. Please ensure cookies and local storage are enabled.',
        actions: 'retry'
      };
    case ErrorCategory.LLM:
      return {
        title: 'LLM Execution Error',
        message: getCleanErrorMessage(error),
        actions: 'retry'
      };
    default:
      return {
        title: 'Error',
        message: getCleanErrorMessage(error),
        actions: 'retry'
      };
  }
}

function renderErrorActions(
  actionType: 'settings' | 'retry' | 'default',
  onRetry: () => void,
  router: ReturnType<typeof useRouter>
) {
  switch (actionType) {
    case 'settings':
      return (
        <>
          <Button
            onClick={() => router.push('/settings')}
            variant="default"
            className="w-full sm:w-auto"
          >
            Go to Settings
          </Button>
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
        </>
      );
    case 'retry':
      return (
        <>
          <Button
            onClick={onRetry}
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
        </>
      );
    default:
      return (
        <>
          <Button
            onClick={onRetry}
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
        </>
      );
  }
}
