/**
 * @fileoverview Root page of the AgentDock application
 * Implements server-side redirect with proper dynamic directive
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { siteConfig } from '@/lib/config';
import { generatePageMetadata } from '@/lib/metadata-utils';

// Ensure dynamic rendering for proper redirects
export const dynamic = 'force-dynamic';

/**
 * Generate metadata for homepage
 */
export const metadata: Metadata = generatePageMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
  ogImageParams: {
    title: siteConfig.description
  }
});

/**
 * Root page that redirects to agents page
 */
export default function HomePage() {
  // Redirect to agents page
  redirect('/agents');
}
