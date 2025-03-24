import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { inter } from '@/lib/fonts';
import './globals.css';
import '@/nodes/cognitive-tools/components/styles.css';
import { metadata as sharedMetadata } from '@/lib/config';
import { LayoutContent } from '@/components/layout/layout-content';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Import system initialization
import '@/lib/core/init';

export const metadata = sharedMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      {/* Add variable font classes to html but rely on FontProvider for active fonts */}
      <body className={inter.className}>
        <LayoutContent>{children}</LayoutContent>
        <SpeedInsights />
      </body>
    </html>
  );
}
