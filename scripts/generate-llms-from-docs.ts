#!/usr/bin/env tsx

/**
 * Generate LLMs.txt files from markdown documentation
 *
 * This script scans all markdown files in the docs directory and its subdirectories,
 * combines them into a single document, and outputs both a summary (llms.txt)
 * and full content version (llms-full.txt).
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Configuration
const DOCS_DIR = path.resolve(__dirname, '../docs');
const OUTPUT_DIR = path.resolve(__dirname, '../public');
const LLMS_FILE = path.join(OUTPUT_DIR, 'llms.txt');
const LLMS_FULL_FILE = path.join(OUTPUT_DIR, 'llms-full.txt');
const SITE_URL = 'https://hub.agentdock.ai';

interface MarkdownFile {
  path: string;
  relativePath: string;
  size: number;
}

interface ProcessedContent {
  summary: string;
  fullContent: string;
}

/**
 * Find all markdown files recursively
 */
async function findMarkdownFiles(dir: string): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subDirFiles = await findMarkdownFiles(fullPath);
      files.push(...subDirFiles);
    } else if (entry.name.endsWith('.md')) {
      const stats = await stat(fullPath);
      files.push({
        path: fullPath,
        relativePath: path.relative(DOCS_DIR, fullPath),
        size: stats.size,
      });
    }
  }

  return files;
}

/**
 * Process markdown content to extract a summary and clean up the content
 */
function processMarkdownContent(content: string, filePath: string): ProcessedContent {
  // Extract title from the first # heading
  let title = 'Untitled Document';
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1];

    // Remove the original title from the content to avoid duplication
    content = content.replace(/^#\s+.+$/m, '').trim();
  }

  // Create a relative URL for this document
  const relativeUrl = path.basename(filePath, '.md');
  const url = `${SITE_URL}/docs/${relativeUrl === 'README' ? '' : relativeUrl}`;

  // Extract a brief description (first paragraph)
  let description = '';
  const paragraphMatch = content.match(/^(?!#)(.+)$/m);
  if (paragraphMatch) {
    description = paragraphMatch[1].trim();
  }

  // For summary, just return the title and description
  const summary = `- [${title}](${url}): ${description}`;

  // For full content, add a header with the URL and the title
  const fullContent = `## ${title}\n${content}\n\n`;

  return { summary, fullContent };
}

/**
 * Main function to generate LLMs.txt files
 */
async function generateLlmsFiles(): Promise<void> {
  console.log('Generating LLMs.txt files from documentation...');

  try {
    // Find all markdown files
    const markdownFiles = await findMarkdownFiles(DOCS_DIR);
    console.log(`Found ${markdownFiles.length} markdown files`);

    // Sort by path to ensure consistent ordering
    markdownFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // Arrays to hold the processed content
    const summaries: string[] = [];
    const fullContents: string[] = [];

    // Add a header for both files
    summaries.push(`# AgentDock Documentation LLMs.txt\n`);
    fullContents.push(`# AgentDock Documentation LLMs-full.txt\n`);

    // Process each file
    for (const file of markdownFiles) {
      console.log(`Processing ${file.relativePath}...`);
      const content = await readFile(file.path, 'utf8');
      const { summary, fullContent } = processMarkdownContent(content, file.path);

      summaries.push(summary);
      fullContents.push(fullContent);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write the files
    await writeFile(LLMS_FILE, summaries.join('\n\n'));
    await writeFile(LLMS_FULL_FILE, fullContents.join('\n'));

    console.log(`✅ LLMs.txt files generated successfully:`);
    console.log(`- ${LLMS_FILE}`);
    console.log(`- ${LLMS_FULL_FILE}`);
  } catch (error) {
    console.error('❌ Error generating LLMs.txt files:', error);
    process.exit(1);
  }
}

// Run the script
generateLlmsFiles();
