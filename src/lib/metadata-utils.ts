import { siteConfig } from './config';
import { Metadata } from 'next';

/**
 * Generate Open Graph image URL with custom parameters
 */
export function generateOgImageUrl({
  title,
  from = '0062F0',
  to = '091E3B',
}: {
  title?: string;
  from?: string;
  to?: string;
}): string {
  // Get the base URL for the OG image API
  const baseUrl = siteConfig.ogImage;
  const params = new URLSearchParams();

  // Add parameters if provided
  if (title) params.set('title', title);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  // Return full URL with parameters
  const paramsString = params.toString();
  return paramsString ? `${baseUrl}?${paramsString}` : baseUrl;
}

/**
 * Generate metadata for a page with custom Open Graph image
 */
export function generatePageMetadata({
  title,
  description,
  ogImageParams,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  ogImageParams?: {
    title?: string;
    from?: string;
    to?: string;
  };
  noIndex?: boolean;
}): Metadata {
  // Generate OG image URL - use title only, no description
  const ogImageUrl = generateOgImageUrl(
    ogImageParams || {
      title,
    },
  );

  // Create metadata object
  const metadata: Metadata = {
    title: title
      ? { absolute: `${title} | ${siteConfig.name}` }
      : { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
    description: description || siteConfig.description,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: siteConfig.url,
      title: title || siteConfig.name,
      description: description || siteConfig.description,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title || siteConfig.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title || siteConfig.name,
      description: description || siteConfig.description,
      images: [ogImageUrl],
      creator: '@agentdock',
    },
  };

  // Add robots noindex directive if requested
  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: true,
    };
  }

  return metadata;
}
