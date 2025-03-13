/**
 * @fileoverview Shared markdown formatting utilities for tool outputs.
 * These utilities help maintain consistent formatting across different tools.
 */

/**
 * Interface for a tool result with type and content
 */
export interface ToolResult {
  type: string;
  content: string;
}

/**
 * Clean text by removing excessive newlines, markdown formatting, and HTML tags
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  // Replace multiple newlines with a single one
  let cleaned = text.replace(/\n{2,}/g, '\n');
  
  // Remove any markdown formatting that might be in the snippet
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/\\n/g, ' ');
  cleaned = cleaned.replace(/\\"/g, '"');
  
  // Remove any HTML tags that might be in the snippet
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Remove any special characters that might cause formatting issues
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  return cleaned.trim();
}

/**
 * Clean a URL for display
 */
export function cleanUrl(url: string): string {
  if (!url || url === '#') return '#';
  
  // Remove tracking parameters
  try {
    const urlObj = new URL(url);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, return the original URL
    return url;
  }
}

/**
 * Format a header with consistent styling
 */
export function formatHeader(text: string, level: 1 | 2 | 3 = 2): string {
  const prefix = '#'.repeat(level);
  return `${prefix} ${text}`;
}

/**
 * Format a subheader with consistent styling
 */
export function formatSubheader(text: string): string {
  return `### ${text}`;
}

/**
 * Format text as bold
 */
export function formatBold(text: string): string {
  return `**${text}**`;
}

/**
 * Format text as italic
 */
export function formatItalic(text: string): string {
  return `*${text}*`;
}

/**
 * Format a link with proper markdown
 */
export function formatLink(text: string, url: string): string {
  return `[${text}](${cleanUrl(url)})`;
}

/**
 * Format a list item with proper indentation
 */
export function formatListItem(text: string, index?: number, ordered: boolean = true): string {
  if (ordered && index !== undefined) {
    return `${index + 1}. ${text}`;
  }
  return `- ${text}`;
}

/**
 * Format an error message with consistent styling
 */
export function formatErrorMessage(type: string, message: string, details?: string): string {
  const header = formatHeader(`${type}`, 2);
  const detailsSection = details ? `\n\n${formatItalic(details)}` : '';
  
  return `${header}\n\n${message}${detailsSection}`;
}

/**
 * Create a standard tool result object
 */
export function createToolResult(type: string, content: string): ToolResult {
  return {
    type,
    content
  };
}

/**
 * Join multiple sections with proper spacing
 */
export function joinSections(...sections: string[]): string {
  return sections.filter(Boolean).join('\n\n');
} 