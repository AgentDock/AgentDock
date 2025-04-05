import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import { notFound, redirect } from 'next/navigation';
import { DocsMarkdown } from '../components/docs-markdown';
import { use } from 'react';
import { docSections } from '@/lib/docs-config';
import { getPrevNextPages } from '@/lib/docs-utils';
import { PrevNextNav } from '@/app/docs/components/prev-next-nav';

// Simple function to get markdown content directly from docs folder
function getMarkdownContent(slug: string[] = []): string | null {
  // For root path, directly return README.md
  if (slug.length === 0) {
    try {
      const readmePath = path.join(process.cwd(), 'docs', 'README.md');
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf8');
        // Prepend /docs/ to relative links in the main docs/README.md
        const fixedContent = content.replace(/\]\((?!\/|#|http)([^)]+)\)/g, (match, relativePath) => {
          // Ensure we don't double-prefix
          if (relativePath.startsWith('docs/')) {
            return `](/docs/${relativePath.substring(5)})`; // Already has docs/, just fix potential extra
          }
          return `](/docs/${relativePath})`; // Prepend /docs/
        });
        return fixedContent;
      }
    } catch (error) {
      console.error('Error reading root README.md:', error);
      return null;
    }
  }

  // Clean up the slug to remove any .md extensions
  const cleanSlug = slug.map(part => part.replace(/\.md$/, ''));
  
  try {
    // First try: direct file path
    const filePath = path.join(process.cwd(), 'docs', ...cleanSlug) + '.md';
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    }
    
    // Second try: README.md in the directory
    const readmePath = path.join(process.cwd(), 'docs', ...cleanSlug, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf8');
      
      // Process the content to fix relative links
      const fixedContent = content.replace(/\]\(\.\.\//g, `](/docs/`)
                                  .replace(/\]\(\.\//g, `](/docs/${cleanSlug.join('/')}/`);
      
      return fixedContent;
    }
    
    // Special case for model-architecture.md
    if (cleanSlug.length === 1 && cleanSlug[0] === 'model-architecture') {
      const altPath = path.join(process.cwd(), 'docs', 'model-architecture.md');
      if (fs.existsSync(altPath)) {
        const content = fs.readFileSync(altPath, 'utf8');
        return content;
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
  const titleMatch = content.match(/^#\s+(.*)$/m);
  return titleMatch ? titleMatch[1] : 'Documentation';
}

// Function to check if URL has .md extension in the last part or if it's README.md
function needsRedirection(slug: string[] = []): boolean {
  if (slug.length === 0) return false;
  
  // Check for .md extension
  if (slug[slug.length - 1].endsWith('.md')) return true;
  
  // Check for README or README.md specifically
  if (slug[slug.length - 1].toLowerCase() === 'readme' || 
      slug[slug.length - 1].toLowerCase() === 'readme.md') return true;
  
  return false;
}

// Function to create a clean URL without README.md or .md extension
function getCleanUrl(slug: string[] = []): string {
  // If the last segment is README or README.md, remove it completely
  if (slug.length > 0 && 
      (slug[slug.length - 1].toLowerCase() === 'readme' || 
       slug[slug.length - 1].toLowerCase() === 'readme.md')) {
    return `/docs/${slug.slice(0, -1).join('/')}`;
  }
  
  // Otherwise just clean up .md extensions
  return `/docs/${slug.map(part => part.replace(/\.md$/, '')).join('/')}`;
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug?: string[] }>;
  }
): Promise<Metadata> {
  const resolvedParams = await props.params;
  const slug = resolvedParams.slug || [];
  const content = getMarkdownContent(slug);
  
  if (!content) {
    return {
      title: 'Not Found',
      description: 'The requested documentation page was not found',
    };
  }
  
  const title = extractTitle(content);
  
  return {
    title: `${title} - AgentDock Documentation`,
    description: `AgentDock documentation - ${title}`,
  };
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
        <PrevNextNav prev={prev} next={next} />
      </div>
    </div>
  );
} 