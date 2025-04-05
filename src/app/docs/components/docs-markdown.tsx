'use client';

import React, { useEffect, useRef } from 'react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';

interface DocsMarkdownProps {
  content: string;
}

// Function to process markdown content and clean up .md extensions in links
function processMarkdownLinks(content: string): string {
  // Process markdown content in a simpler way that preserves Next.js navigation
  let processedContent = content;
  
  // Handle README.md links - replace with directory path
  processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]*\/README\.md)(?:#[^)]*)?\)/gi, (match, text, url) => {
    const cleanUrl = url.replace(/\/README\.md$/i, '');
    return `[${text}](${cleanUrl})`;
  });
  
  // Clean all .md extensions in links
  processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\.md(?:#[^)]*)?\)/g, (match, text, url) => {
    return `[${text}](${url})`;
  });
  
  return processedContent;
}

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Process the markdown content to clean up .md extensions in links
  const processedContent = processMarkdownLinks(content);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Find all headings in the document container
    const headings = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach((heading) => {
      if (!(heading instanceof HTMLElement)) return;
      
      // Generate ID from heading text if it doesn't exist
      if (!heading.id) {
        const headingText = heading.innerText;
        heading.id = headingText
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      
      // Only wrap the text content in a clickable link, not the entire heading
      if (!heading.querySelector('.header-link-wrapper')) {
        // Get the current text content
        const headingText = heading.textContent || '';
        
        // Create anchor link that wraps just the text
        const linkWrapper = document.createElement('a');
        linkWrapper.className = 'header-link-wrapper';
        linkWrapper.href = `#${heading.id}`;
        
        // Create the link icon element (hidden by default, shown on hover)
        const linkIcon = document.createElement('span');
        linkIcon.className = 'header-link-icon';
        linkIcon.innerHTML = '🔗';
        linkIcon.setAttribute('aria-hidden', 'true');
        
        // Clear the heading
        heading.innerHTML = '';
        
        // Add the text directly
        linkWrapper.textContent = headingText;
        
        // Append the icon
        linkWrapper.appendChild(linkIcon);
        
        // Append link wrapper to heading
        heading.appendChild(linkWrapper);
        
        // Add click handler to copy URL to clipboard
        linkWrapper.addEventListener('click', (e) => {
          // Don't prevent default to allow normal anchor navigation
          
          // Get the full URL with the hash
          const url = window.location.href.split('#')[0] + `#${heading.id}`;
          navigator.clipboard.writeText(url);
          
          // Visual feedback
          const icon = linkWrapper.querySelector('.header-link-icon');
          if (icon instanceof HTMLElement) {
            icon.style.opacity = '1';
            
            setTimeout(() => {
              icon.style.opacity = '';
            }, 500);
          }
        });
      }
    });
    
    // Find all links in the document and process them
    const links = containerRef.current.querySelectorAll('a');
    links.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      
      // Only process relative links with .md extension
      if (link.href && 
          !link.href.startsWith('http') && 
          !link.href.startsWith('#') && 
          link.href.endsWith('.md')) {
        // Clean the URL
        link.href = link.href.replace(/\.md$/, '');
      }
    });
  }, [processedContent]);

  return (
    <div ref={containerRef} className="docs-content w-full max-w-4xl prose prose-slate dark:prose-invert">
      <MarkdownRenderer>{processedContent}</MarkdownRenderer>
    </div>
  );
} 