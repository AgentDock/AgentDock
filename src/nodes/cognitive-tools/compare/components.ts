/**
 * @fileoverview Compare Tool UI components for rendering structured comparisons.
 * These components provide a clean interface for displaying AI comparison analyses.
 */

import { createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Compare component interface
 */
export interface CompareComponentProps {
  topic?: string;
  comparison: string;
}

/**
 * Format comparison for better readability while preserving and enhancing Markdown formatting
 */
function formatComparisonContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Special case for the analyzing state
  if (text === 'Analyzing...' || text === 'Comparing...') {
    return text;
  }
  
  let formatted = text;
  
  // Fix <br> tags - convert them to actual newlines in markdown
  // This addresses the issue where <br> tags are shown as text instead of creating line breaks
  formatted = formatted.replace(/<br>/gi, '  \n');
  
  // Ensure proper spacing for list items (both numbered and bullet points)
  formatted = formatted.replace(/^(\d+\.\s)/gm, '\n$1');
  formatted = formatted.replace(/^([-*]\s)/gm, '\n$1');
  
  // Ensure heading tags have proper spacing
  formatted = formatted.replace(/^(#{1,6}\s)/gm, '\n$1');
  
  // Enhance blockquote formatting
  formatted = formatted.replace(/^>\s*(.+)$/gm, '\n> *$1*');
  
  // Find and fix table formatting - critical for comparison views
  const hasTable = formatted.includes('|') && (formatted.includes('\n|') || formatted.match(/[-:|\s]+/));
  if (hasTable) {
    // First, identify table blocks
    const tablePattern = /((?:\|.+\|\r?\n)+)/g;
    formatted = formatted.replace(tablePattern, (tableMatch) => {
      // Process each table
      let processedTable = tableMatch;
      
      // Fix <br> tags in tables (in case they weren't caught by the earlier replacement)
      processedTable = processedTable.replace(/<br>/gi, '  \n');
      
      // Ensure proper pipe character formatting (ensure spaces around content)
      processedTable = processedTable.replace(/\|([^|\n\r]+?)\|/g, '| $1 |');
      processedTable = processedTable.replace(/\|\s{2,}/g, '| ');
      processedTable = processedTable.replace(/\s{2,}\|/g, ' |');
      
      // Ensure the header separator row has proper dashes and alignment indicators
      // Look for patterns like: | Header | Header |
      const headerRowPattern = /\|(.*?)\|\n\|(?:[^-:|\n]*?)\|/;
      const headerMatch = processedTable.match(headerRowPattern);
      
      if (headerMatch) {
        // Count the columns in the header
        const headerCols = (headerMatch[1].match(/\|/g) || []).length + 1;
        
        // Create a proper separator row
        let separatorRow = '|';
        for (let i = 0; i < headerCols; i++) {
          separatorRow += ' --- |';
        }
        
        // Insert separator row if it doesn't exist or fix it if it's malformed
        if (!processedTable.includes('| --- |') && !processedTable.includes('|---')) {
          processedTable = processedTable.replace(/\|(.*?)\|\n/i, `$&${separatorRow}\n`);
        }
      }
      
      // Add extra newlines before and after the table for proper rendering
      return `\n${processedTable}\n`;
    });
  }
  
  // Enhance comparison symbols for better visibility
  formatted = formatted.replace(/✓/g, '**✓**');
  formatted = formatted.replace(/✗/g, '**✗**');
  formatted = formatted.replace(/✅/g, '**✅**');
  formatted = formatted.replace(/❌/g, '**❌**');
  
  // If the text doesn't already have bold or italic formatting,
  // selectively add some emphasis to important comparison phrases
  if (!formatted.includes('**') && !formatted.includes('*')) {
    // Add bold to phrases indicating importance or conclusion
    const emphasisPhrases = [
      'better', 'worse', 'preferred', 'recommended', 'not recommended',
      'advantage', 'disadvantage', 'superior', 'inferior', 'trade-off',
      'key difference', 'similarity', 'contrast'
    ];
    
    emphasisPhrases.forEach(phrase => {
      // Use a regex that ensures we don't match partial words
      const regex = new RegExp(`\\b(${phrase})\\b`, 'gi');
      formatted = formatted.replace(regex, '**$1**');
    });
  }
  
  return formatted;
}

/**
 * Compare component for displaying structured comparisons
 */
export function CompareComponent({ 
  topic = "", 
  comparison = ""
}: CompareComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';
  
  // Format comparison with enhanced markdown
  const formattedComparison = formatComparisonContent(comparison);
  
  // Construct the title with the topic if provided
  const title = safeTopicText 
    ? `## 🔍 Comparing: ${safeTopicText}`
    : `## 🔍 Structured Comparison`;
  
  // Special case for the analyzing state
  if (formattedComparison === 'Analyzing...' || formattedComparison === 'Comparing...') {
    return createToolResult(
      'compare_result',
      `${title}\n\n${formattedComparison}`
    );
  }
  
  // Return the complete comparison with enhanced markdown formatting
  return createToolResult(
    'compare_result',
    `${title}\n\n${formattedComparison}`
  );
} 