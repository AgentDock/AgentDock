import { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/*', '/settings/*']
    },
    sitemap: `${siteConfig.url}/sitemap.xml`
  };
}
