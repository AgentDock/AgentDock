/**
 * Generate Search Index for Documentation
 *
 * This script:
 * 1. Scans all markdown files in the docs directory
 * 2. Extracts titles and content snippets
 * 3. Creates a search index as a JSON file in the public directory
 *
 * The index is used by the client-side search functionality in the docs.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { extractTitle, getFilesFromDir } from '../src/lib/docs-utils';
import { v4 as uuidv4 } from 'uuid';
import { logger, LogCategory } from 'agentdock-core';

// Type for a search result item
interface SearchResult {
  id: string;
  title: string;
  content: string;
  url: string;
}

// Get content snippet (first paragraph or two) from markdown content
function getContentSnippet(content: string, maxLength: number = 150): string {
  // Remove code blocks to avoid them in snippets
  const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '');

  // Get first few paragraphs
  const paragraphs = contentWithoutCode
    .split('\n\n')
    .filter((p) => p.trim() && !p.trim().startsWith('#'));
  let snippet = paragraphs.slice(0, 2).join(' ').replace(/\n/g, ' ');

  // Truncate if needed
  if (snippet.length > maxLength) {
    snippet = snippet.substring(0, maxLength) + '...';
  }

  return snippet;
}

// Convert a path like 'architecture/sessions/session-overview.md' to a URL
function pathToUrl(filePath: string): string {
  // Remove .md extension and construct URL
  return `/docs/${filePath.replace(/\.md$/, '')}`;
}

// Format a title to be more readable
function formatTitle(title: string): string {
  return title.trim();
}

// Function to scan a directory recursively for markdown files
async function scanDirectory(dirPath: string, basePath: string = ''): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath, relativePath);
      files.push(...subFiles);
    } else if (entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
  }

  return files;
}

// Main function to generate the search index
async function generateSearchIndex() {
  const docsDir = path.join(process.cwd(), 'docs');
  const outputPath = path.join(process.cwd(), 'public/search-index.json');

  try {
    // Scan all markdown files in docs directory
    const allFiles = await scanDirectory(docsDir);

    logger.info(
      LogCategory.CONFIG,
      'Generating search index',
      `Found ${allFiles.length} markdown files`,
    );

    // Process each file to extract relevant information
    const searchResults: SearchResult[] = [];

    for (const file of allFiles) {
      try {
        const filePath = path.join(docsDir, file);
        const content = await fs.readFile(filePath, 'utf8');

        // Extract data from the content
        const title = formatTitle(extractTitle(content) || 'Untitled Document');
        const snippet = getContentSnippet(content);
        const url = pathToUrl(file);

        // Create search result entry
        searchResults.push({
          id: uuidv4(),
          title,
          content: snippet,
          url,
        });
      } catch (error) {
        logger.warn(
          LogCategory.CONFIG,
          'Error processing file for search index',
          `File: ${file}, Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Write the search index to a JSON file
    await fs.writeFile(outputPath, JSON.stringify(searchResults, null, 2));

    logger.info(
      LogCategory.CONFIG,
      'Search index generated successfully',
      `Created index with ${searchResults.length} entries at ${path.relative(process.cwd(), outputPath)}`,
    );
  } catch (error) {
    logger.error(
      LogCategory.CONFIG,
      'Failed to generate search index',
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    process.exit(1);
  }
}

// Run the script
generateSearchIndex();
