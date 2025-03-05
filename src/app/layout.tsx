import { Inter } from 'next/font/google';
import './globals.css';
import { metadata as sharedMetadata } from '@/lib/config';
import { LayoutContent } from '@/components/layout/layout-content';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Import system initialization
import '@/lib/core/init';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <LayoutContent>{children}</LayoutContent>
        <SpeedInsights />
      </body>
    </html>
  );
}
