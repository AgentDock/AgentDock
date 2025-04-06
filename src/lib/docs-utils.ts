/**
 * Documentation Utilities
 * 
 * This file handles:
 * - Reading markdown files from the docs directory
 * - Extracting titles from markdown content
 * - Generating sidebar navigation based on the config
 */

import fs from 'fs';
import path from 'path';
import { DocSection } from './docs-config';

// Types for sidebar items and sections
export interface SidebarItem {
  title: string;  // Text shown in the sidebar link
  href: string;   // URL to navigate to when clicked
}

export interface SidebarSection {
  title: string;           // Section heading
  items: SidebarItem[];    // Links within this section
}

// --- Interfaces for PrevNext --- 
interface PageLink {
  path: string;
  title: string;
}

interface PrevNext {
  prev: PageLink | null;
  next: PageLink | null;
}
// -------------------------------

// Doc item interface
export interface DocItem {
  title: string;
  url?: string;
  items?: DocItem[];
}

// Function to extract title from markdown content
export function extractTitle(content: string): string | null {
  // Look for the first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  return null;
}

// Format a filename or path part into a readable title
export function formatTitle(name: string): string {
  return name
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Process file path for sidebar display
export function processFilePath(filePath: string): string {
  // If the file is README.md, return the directory path
  if (filePath.endsWith('/README.md')) {
    return filePath.replace(/\/README\.md$/, '');
  }
  
  // Otherwise just remove the .md extension
  return filePath.replace(/\.md$/, '');
}

// Get all markdown files from a directory
export function getFilesFromDir(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const files = fs.readdirSync(dir);
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    return [];
  }
}

// Get items for the given file
export function getFileItems(basePath: string): DocItem[] {
  try {
    // Check if the path exists
    if (!fs.existsSync(basePath)) {
      console.error(`Path does not exist: ${basePath}`);
      return [];
    }

    // Get stats for the path
    const stats = fs.statSync(basePath);

    // If it's a directory, recursively get items
    if (stats.isDirectory()) {
      const files = fs.readdirSync(basePath);
      const items: DocItem[] = [];

      // Process directories first
      const directories = files.filter(file => {
        const filePath = path.join(basePath, file);
        return fs.statSync(filePath).isDirectory();
      });

      // Add directory items
      for (const dir of directories) {
        const dirPath = path.join(basePath, dir);
        const dirItems = getFileItems(dirPath);
        
        if (dirItems.length > 0) {
          // Get the relative path from docs dir
          const relativePath = path.relative(path.join(process.cwd(), 'docs'), dirPath);
          
          // Check if the directory has a README.md
          const readmePath = path.join(dirPath, 'README.md');
          const hasReadme = fs.existsSync(readmePath);
          
          // Use the README.md for the section if it exists
          const url = hasReadme ? 
            `/docs/${relativePath.split(path.sep).join('/')}` : 
            undefined;
          
          items.push({
            title: formatTitle(dir),
            items: dirItems,
            url
          });
        }
      }

      // Process markdown files
      const markdownFiles = files.filter(file => {
        return file.endsWith('.md') && file !== 'README.md';
      });

      // Add markdown items
      for (const file of markdownFiles) {
        const filePath = path.join(basePath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const title = extractTitle(content) || formatTitle(file.replace('.md', ''));
        
        // Get the relative path from docs dir for URL
        const relativePath = path.relative(path.join(process.cwd(), 'docs'), filePath);
        const url = `/docs/${processFilePath(relativePath).split(path.sep).join('/')}`;
        
        items.push({
          title,
          url
        });
      }

      return items;
    } else if (stats.isFile() && basePath.endsWith('.md')) {
      // If it's a markdown file, return it as an item
      const content = fs.readFileSync(basePath, 'utf8');
      const title = extractTitle(content) || formatTitle(path.basename(basePath).replace('.md', ''));
      
      // Get the relative path from docs dir for URL
      const relativePath = path.relative(path.join(process.cwd(), 'docs'), basePath);
      const url = `/docs/${processFilePath(relativePath).split(path.sep).join('/')}`;
      
      return [{
        title,
        url
      }];
    }

    return [];
  } catch (error) {
    console.error('Error getting file items:', error);
    return [];
  }
}

// Convert a config section to a sidebar section
export function mapSectionToSidebar(section: DocSection): SidebarSection {
  let items: SidebarItem[] = [];
  
  // Add manually specified items from config
  if (section.items && section.items.length > 0) {
    items = section.items.map(item => ({
      title: item.title,
      href: `/docs/${item.path}`,
    }));
  }
  
  // Add auto-generated items from the directory
  if (section.basePath) {
    const autoItems = getFileItems(section.basePath);
    
    // Convert DocItem to SidebarItem
    const convertedItems = autoItems.map(item => {
      if (item.url) {
        return {
          title: item.title,
          href: item.url
        } as SidebarItem;
      }
      // Handle nested items if needed
      return null;
    }).filter(Boolean) as SidebarItem[];
    
    items = [...items, ...convertedItems];
  }
  
  return {
    title: section.title,
    items,
  };
}

// Generate the complete sidebar from config sections
export function generateSidebar(sections: DocSection[]): SidebarSection[] {
  return sections.map(mapSectionToSidebar);
}

// --- NEW getPrevNextPages Function --- 

// Helper to normalize doc paths consistently
function normalizeDocPath(p: string): string {
  // Special case for root
  if (p === '/' || p === 'docs' || p === 'docs/') {
    return '/docs';
  }
  // Ensure it starts with /docs/
  let normalPath = p.startsWith('/docs/') ? p : `/docs/${p}`;
  // Remove trailing slash if it exists and isn't the only character after /docs/
  if (normalPath.endsWith('/') && normalPath.length > 6) { 
    normalPath = normalPath.slice(0, -1);
  }
  return normalPath;
}

/**
 * Flattens the docSections config into a single list of pages 
 * respecting the defined order of manually specified items.
 */
function flattenDocSections(sections: DocSection[]): PageLink[] {
  const flatList: PageLink[] = [];
  sections.forEach(section => {
    if (section.items) {
      section.items.forEach(item => {
        // Normalize the path before adding
        const normalizedPath = normalizeDocPath(item.path);
        if (!flatList.some(p => p.path === normalizedPath)) {
           flatList.push({ title: item.title, path: normalizedPath });
        }
      });
    }
  });
  return flatList;
}

/**
 * Finds the previous and next pages relative to the current page
 * based on the flattened order defined in docs-config.ts.
 *
 * @param currentPathSegments - The slug segments for the current page (e.g., ['architecture', 'state-management'])
 * @param sections - The docSections configuration array.
 */
export function getPrevNextPages(currentPathSegments: string[] = [], sections: DocSection[]): PrevNext {
  // Create the flattened, ordered list of all pages with normalized paths
  const flatList = flattenDocSections(sections);

  // Construct and normalize the current path from segments
  const currentPath = normalizeDocPath(currentPathSegments.join('/'));

  // Find the index of the current page in the flattened list
  const currentIndex = flatList.findIndex(page => page.path === currentPath);

  // If the current page isn't found in the list, return null for both
  if (currentIndex === -1) {
    console.warn(`[getPrevNextPages] Current path '${currentPath}' not found in flattened list.`);
    return { prev: null, next: null };
  }

  // Determine previous and next pages
  const prevPage = currentIndex > 0 ? flatList[currentIndex - 1] : null;
  const nextPage = currentIndex < flatList.length - 1 ? flatList[currentIndex + 1] : null;

  // Helper to ensure the final path starts with a '/' for Link component
  const formatLink = (page: PageLink | null): PageLink | null => {
    if (!page) return null;
    // Path should already be normalized and start with /docs, 
    // but ensure it starts with '/' for Link href
    return {
      ...page,
      path: page.path.startsWith('/') ? page.path : `/${page.path}`
    };
  };

  return {
    prev: formatLink(prevPage),
    next: formatLink(nextPage),
  };
}