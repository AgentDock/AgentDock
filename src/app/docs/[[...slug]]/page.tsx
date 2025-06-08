import fs from 'fs';
import path from 'path';
import { use } from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PrevNextNav } from '@/app/docs/components/prev-next-nav';
import { docSections } from '@/lib/docs-config';
import { getPrevNextPages } from '@/lib/docs-utils';
import { generatePageMetadata } from '@/lib/metadata-utils';
import { DocsMarkdown } from '../components/docs-markdown';

// Get the docs directory path that works in both development and production
function getDocsBasePath(): string {
  // Next.js will include the docs folder in the serverless function
  // thanks to our outputFileTracingIncludes config
  return path.join(process.cwd(), 'docs');
}

// Helper for case-insensitive file access
function readFileWithFallback(filePath: string, fallbackPath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return fs.readFileSync(fallbackPath, 'utf8');
  }
}

// Simple function to get markdown content directly from docs folder
function getMarkdownContent(slug: string[] = []): string | null {
  const basePath = getDocsBasePath();

  // For root path, load README.md
  if (slug.length === 0) {
    try {
      const upperReadmePath = path.join(basePath, 'README.md');
      const lowerReadmePath = path.join(basePath, 'readme.md');

      let content = null;

      // Try both README.md and readme.md
      if (fs.existsSync(upperReadmePath)) {
        content = fs.readFileSync(upperReadmePath, 'utf8');
      } else if (fs.existsSync(lowerReadmePath)) {
        content = fs.readFileSync(lowerReadmePath, 'utf8');
      } else {
        return null;
      }

      // Prepend /docs/ to relative links in the main docs/README.md
      const fixedContent = content.replace(
        /\]\((?!\/|#|http)([^)]+)\)/g,
        (match, relativePath) => {
          // Ensure we don't double-prefix
          if (relativePath.startsWith('docs/')) {
            return `](/docs/${relativePath.substring(5)})`; // Already has docs/, just fix potential extra
          }
          return `](/docs/${relativePath})`; // Prepend /docs/
        }
      );

      return fixedContent;
    } catch (error) {
      console.error('Error reading root README.md:', error);
      return null;
    }
  }

  // Clean up the slug to remove any .md extensions
  const cleanSlug = slug.map((part) => part.replace(/\.md$/, ''));

  try {
    // Try different file paths in a clean, maintainable sequence

    // 1. Direct .md file
    const directFilePath = path.join(basePath, ...cleanSlug) + '.md';
    if (fs.existsSync(directFilePath)) {
      return fs.readFileSync(directFilePath, 'utf8');
    }

    // 2. README.md in a directory
    const dirPath = path.join(basePath, ...cleanSlug);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const upperReadmePath = path.join(dirPath, 'README.md');
      const lowerReadmePath = path.join(dirPath, 'readme.md');

      let content = null;

      // Try README.md first, then readme.md
      if (fs.existsSync(upperReadmePath)) {
        content = fs.readFileSync(upperReadmePath, 'utf8');
      } else if (fs.existsSync(lowerReadmePath)) {
        content = fs.readFileSync(lowerReadmePath, 'utf8');
      }

      if (content) {
        // Process the content to fix relative links
        return content
          .replace(/\]\(\.\.\//g, `](/docs/`)
          .replace(/\]\(\.\//g, `](/docs/${cleanSlug.join('/')}/`);
      }

      // 3. First .md file in the directory
      const dirContents = fs.readdirSync(dirPath);
      const mdFile = dirContents.find((file) =>
        file.toLowerCase().endsWith('.md')
      );
      if (mdFile) {
        content = fs.readFileSync(path.join(dirPath, mdFile), 'utf8');
        // Fix relative links
        return content
          .replace(/\]\(\.\.\//g, `](/docs/`)
          .replace(/\]\(\.\//g, `](/docs/${cleanSlug.join('/')}/`);
      }
    }

    // Special case for model-architecture.md
    if (cleanSlug.length === 1 && cleanSlug[0] === 'model-architecture') {
      const altPath = path.join(basePath, 'model-architecture.md');
      if (fs.existsSync(altPath)) {
        return fs.readFileSync(altPath, 'utf8');
      }
    }

    return null;
  } catch (error) {
    console.error('Error reading markdown file:', error);
    return null;
  }
}

// Extract title from markdown content
function extractTitle(content: string): string {
  // Look for a level 1 heading (# Title)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // Fallback: use the first line as title
  const firstLine = content.trim().split('\n')[0];
  return firstLine || 'Documentation';
}

// Function to check if URL has .md extension in the last part or if it's README.md
function needsRedirection(slug: string[] = []): boolean {
  if (slug.length === 0) return false;

  // Check for .md extension
  if (slug[slug.length - 1].endsWith('.md')) return true;

  // Check for README or README.md specifically
  if (
    slug[slug.length - 1].toLowerCase() === 'readme' ||
    slug[slug.length - 1].toLowerCase() === 'readme.md'
  )
    return true;

  return false;
}

// Function to create a clean URL without README.md or .md extension
function getCleanUrl(slug: string[] = []): string {
  // If the last segment is README or README.md, remove it completely
  if (
    slug.length > 0 &&
    (slug[slug.length - 1].toLowerCase() === 'readme' ||
      slug[slug.length - 1].toLowerCase() === 'readme.md')
  ) {
    return `/docs/${slug.slice(0, -1).join('/')}`;
  }

  // Otherwise just clean up .md extensions
  return `/docs/${slug.map((part) => part.replace(/\.md$/, '')).join('/')}`;
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await props.params;
  const slug = resolvedParams.slug || [];
  const content = getMarkdownContent(slug);

  if (!content) {
    return {
      title: 'Not Found',
      description: 'The requested documentation page was not found'
    };
  }

  const title = extractTitle(content);

  // Extract first paragraph for description
  let description = '';
  const paragraphMatch = content.match(/^(?!#)(.+)$/m);
  if (paragraphMatch && paragraphMatch[1]) {
    description = paragraphMatch[1].trim();
  }

  // Use metadata utility without description in OG params
  return generatePageMetadata({
    title: `${title} - AgentDock Documentation`,
    description: description || `AgentDock documentation - ${title}`,
    ogImageParams: {
      title: title
    }
  });
}

export default function DocPage(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  // Unwrap the params Promise using the 'use' hook
  const resolvedParams = use(props.params);
  // Handle the optional slug param (will be undefined for /docs)
  const slug = resolvedParams.slug || [];

  // Redirect if any part of the URL contains .md extension
  if (needsRedirection(slug)) {
    const cleanUrl = getCleanUrl(slug);
    redirect(cleanUrl);
  }

  const content = getMarkdownContent(slug);

  if (!content) {
    notFound();
  }

  // --- Get Previous/Next Links ---
  const { prev, next } = getPrevNextPages(slug, docSections);
  // ---------------------------------

  return (
    <div className="docs-page-container">
      <div className="px-4 py-6 md:px-8 md:py-6">
        <DocsMarkdown content={content} />
        <PrevNextNav
          prev={prev}
          next={next}
        />
      </div>
    </div>
  );
}
