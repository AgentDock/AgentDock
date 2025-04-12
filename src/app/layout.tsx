import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { inter } from '@/lib/fonts';
import './globals.css';
import '@/nodes/cognitive-tools/components/styles.css';
import { metadata as sharedMetadata } from '@/lib/config';
import { LayoutContent } from '@/components/layout/layout-content';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { EnvOverrideProvider } from '@/components/env-override-provider';
import { PostHogProvider } from '@/components/providers/posthog-provider';

// Import system initialization
import '@/lib/core/init';

// NOTE: We're using the package-based PostHog implementation (via posthog-provider.tsx)
// instead of the script-based implementation to avoid interfering with tool calling.
// The direct script implementation can modify global objects and network handling
// in ways that break the Vercel AI SDK's tool calling functionality.

// Preload the fonts at the root level and add them only once
// This ensures they're available immediately and prevents font flickering
const fontClasses = `${GeistSans.variable} ${GeistMono.variable} ${inter.variable}`;

export const metadata = sharedMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const posthogApiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY || '';
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  // Only enable in production unless explicitly enabled in development
  const analyticsEnabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  
  return (
    <html lang="en" suppressHydrationWarning className={fontClasses}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className}>
        <PostHogProvider 
          apiKey={posthogApiKey} 
          apiHost={posthogHost}
          enabled={analyticsEnabled}
        >
          <EnvOverrideProvider>
            <LayoutContent>{children}</LayoutContent>
          </EnvOverrideProvider>
        </PostHogProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
