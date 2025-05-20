'use client';

import { useEffect, createContext, useContext, ReactNode, Suspense } from 'react';
import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';

// Define options directly in the provider
const posthogOptions = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  // Critical settings to prevent interference with tool calling
  capture_pageview: false, // We'll track pageviews manually
  autocapture: false, // Disable automatic event capture
  capture_pageleave: false, // Don't track page leave events
  disable_session_recording: true, // Disable session recording
  disable_persistence: false, // Keep persistence for user identification
  disable_cookie: false, // Allow cookies for identification
  persistence: 'localStorage' as const, // Use localStorage for persistence
  loaded: (posthogInstance: any) => {
    if (process.env.NODE_ENV === 'development') {
      // In development, log PostHog events to the console
      // @ts-ignore
      window.posthog = posthogInstance;
    }
  },
};

// Create a PostHog context
type PostHogContextType = {
  posthog: typeof posthog | null;
  capture: (event: string, properties?: Record<string, any>) => void;
};

const PostHogContext = createContext<PostHogContextType>({
  posthog: null,
  capture: () => {}, // Noop function for when PostHog isn't initialized
});

// Hook for consuming the PostHog context
export const usePostHog = () => useContext(PostHogContext);

// PageView tracker component that uses useSearchParams
function PageViewTracker({ enabled, apiKey }: { enabled: boolean; apiKey: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views manually
  useEffect(() => {
    if (!enabled || !apiKey || !posthog) return;

    // Construct the URL from pathname and search params
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Use a timeout to ensure this doesn't interfere with initial page rendering and tool calling
    const timer = setTimeout(() => {
      posthog.capture('$pageview', {
        current_url: url,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[PostHog] Pageview captured:', url);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, enabled, apiKey]);

  return null; // This component doesn't render anything
}

// PostHog provider component
export function PostHogProvider({
  children,
  apiKey,
  apiHost = 'https://app.posthog.com',
  enabled = process.env.NODE_ENV === 'production',
}: {
  children: ReactNode;
  apiKey: string;
  apiHost?: string;
  enabled?: boolean;
}) {
  // Initialize PostHog only once when the provider mounts
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostHog] Initialization started');
      console.log('[PostHog] API Key exists:', !!apiKey);
    }

    // Check if we have an API key before attempting to initialize
    if (enabled && apiKey) {
      // Initialize posthog with the options defined at the top
      posthog.init(apiKey, posthogOptions);

      // Enable debug in development
      if (process.env.NODE_ENV === 'development') {
        posthog.debug();
        console.log('[PostHog] Successfully initialized');
      }
    }

    return () => {
      // Clean up if needed
    };
  }, [apiKey, enabled]);

  // Define a capture function to abstract PostHog usage
  const capture = (event: string, properties?: Record<string, any>) => {
    if (enabled && apiKey && posthog) {
      posthog.capture(event, properties);

      if (process.env.NODE_ENV === 'development') {
        console.log('[PostHog] Event captured:', event, properties);
      }
    }
  };

  return (
    <PostHogContext.Provider
      value={{
        posthog: enabled && apiKey ? posthog : null,
        capture,
      }}
    >
      {children}
      {/* Wrap the page view tracker in Suspense */}
      <Suspense fallback={null}>
        <PageViewTracker enabled={enabled} apiKey={apiKey} />
      </Suspense>
    </PostHogContext.Provider>
  );
}
