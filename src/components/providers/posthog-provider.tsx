'use client';

import { useEffect, createContext, useContext, ReactNode } from 'react';
import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';

// Define options directly in the provider (MOVED OUTSIDE useEffect)
const posthogOptions = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  // Critical settings to prevent interference with tool calling
  capture_pageview: false,     // We'll track pageviews manually
  autocapture: true,          // RE-ENABLED automatic event capture
  capture_pageleave: false,    // Don't track page leave events
  disable_session_recording: true, // Disable session recording
  disable_persistence: false,  // Keep persistence for user identification
  disable_cookie: false,       // Allow cookies for identification
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize PostHog on mount
  useEffect(() => {
    if (!enabled || !apiKey) return;

    // Initialize PostHog with options that won't interfere with tool calling (use options defined above)
    const options = {
      ...posthogOptions, // Use the options defined outside
      api_host: apiHost
    };

    posthog.init(apiKey, options);

    // Clean up PostHog when component unmounts (no explicit cleanup needed)
    return () => {
      // PostHog doesn't have a shutdown method
    };
  }, [apiKey, apiHost, enabled]);

  // Track page views manually
  useEffect(() => {
    if (!enabled || !apiKey || !posthog) return;

    // Only track page views if posthog is fully loaded
    if (!posthog.isFeatureEnabled) return;

    // Construct the URL from pathname and search params
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Use a timeout to ensure this doesn't interfere with initial page rendering and tool calling
    const timer = setTimeout(() => {
      posthog.capture('$pageview', {
        current_url: url,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, enabled, apiKey]);

  // Define a capture function to abstract PostHog usage
  const capture = (event: string, properties?: Record<string, any>) => {
    if (enabled && apiKey && posthog) {
      posthog.capture(event, properties);
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
    </PostHogContext.Provider>
  );
} 