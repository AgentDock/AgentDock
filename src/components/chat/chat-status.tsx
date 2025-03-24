"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { APIError, ErrorCode, logger, LogCategory } from 'agentdock-core'
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner />
      <span className="ml-2 text-sm text-gray-500">Loading chat...</span>
    </div>
  );
}

export function ChatError({ error, onRetry }: { error: Error, onRetry: () => void }) {
  const router = useRouter();

  React.useEffect(() => {
    logger.error(
      LogCategory.API,
      'ChatContainer',
      'Chat error occurred',
      { error: error.message }
    );
  }, [error]);

  // Enhanced error type checking
  const isMissingApiKey = error instanceof APIError && 
    error.code === ErrorCode.CONFIG_NOT_FOUND &&
    error.message.toLowerCase().includes('api key');
  
  const isConnectionError = error instanceof Error && 
    (error.message.includes('ECONNRESET') || 
     error.message.includes('Failed to fetch') ||
     error.message.includes('Network error'));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="p-4 text-sm bg-red-100 rounded">
        <p className="text-red-500 font-medium mb-2">
          {isMissingApiKey ? 'API Key Required' : 'Error'}
        </p>
        <p className="text-red-700">
          {error instanceof APIError ? error.message : 
           isConnectionError ? 'Connection lost. Please check your internet connection and try again.' :
           'An error occurred while processing your request'}
        </p>
      </div>
      {isMissingApiKey ? (
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => router.push('/settings')}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
          >
            Go to Settings
          </button>
          <p className="text-sm text-gray-600">
            Add your API key in settings or set the appropriate environment variable in your .env.local file.
          </p>
          <p className="text-xs text-gray-500">
            Environment variables should be named like ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button 
            onClick={onRetry}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded hover:bg-red-600"
          >
            Try Again
          </button>
          {isConnectionError && (
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          )}
        </div>
      )}
    </div>
  );
} 