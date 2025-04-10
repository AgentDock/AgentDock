import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/config';
import { templates } from '@/generated/templates';
import { AGENT_TAGS } from '@/config/agent-tags';
import fs from 'fs';
import path from 'path';

// Helper function to get docs paths
function getDocsPaths(): string[] {
  const docsBasePath = path.join(process.cwd(), 'docs');
  
  function scanDirectory(dir: string, basePathLength: number, results: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath, basePathLength, results);
      } else if (entry.name.endsWith('.md')) {
        // Skip README.md files as they map to the directory itself
        if (entry.name.toLowerCase() === 'readme.md') continue;
        
        // Convert file path to URL path
        const relativePath = fullPath.slice(basePathLength);
        const urlPath = `/docs${relativePath.replace(/\.md$/, '').replace(/\\/g, '/')}`;
        results.push(urlPath);
      }
    }
    
    return results;
  }
  
  return scanDirectory(docsBasePath, docsBasePath.length);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  
  // Add static routes
  const staticRoutes = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/image-generation`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];
  
  // Add agent category pages
  const categoryRoutes = AGENT_TAGS.map(tag => ({
    url: `${baseUrl}/agents/${tag.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  
  // Add documentation pages
  const docRoutes = getDocsPaths().map(docPath => ({
    url: `${baseUrl}${docPath}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  
  // Combine all routes
  return [...staticRoutes, ...categoryRoutes, ...docRoutes];
} 