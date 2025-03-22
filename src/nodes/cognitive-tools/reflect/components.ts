/**
 * @fileoverview Reflect Tool UI components for rendering retrospective analysis.
 * These components provide a clean interface for displaying AI reflections.
 */

import { createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Reflect component interface
 */
export interface ReflectComponentProps {
  topic?: string;
  reflection: string; 
  confidence?: number;
}

/**
 * Format reflection for better readability while preserving and enhancing Markdown formatting
 */
function formatReflectionContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Special case for the analyzing state
  if (text === 'Reflecting...') {
    return text;
  }
  
  let formatted = text;
  
  // Ensure proper spacing for list items (both numbered and bullet points)
  formatted = formatted.replace(/^(\d+\.\s)/gm, '\n$1');
  formatted = formatted.replace(/^([-*]\s)/gm, '\n$1');
  
  // Ensure heading tags have proper spacing
  formatted = formatted.replace(/^(#{1,6}\s)/gm, '\n$1');
  
  // Enhance blockquote formatting for insights
  formatted = formatted.replace(/^>\s*(.+)$/gm, '\n> *$1*');
  
  // Find and fix table formatting
  const hasTable = formatted.includes('|') && (formatted.includes('\n|') || formatted.match(/\|[-:|\s]+\|/));
  if (hasTable) {
    // First, identify table blocks
    const tablePattern = /((?:\|.+\|\r?\n)+)/g;
    formatted = formatted.replace(tablePattern, (tableMatch) => {
      // Process each table
      let processedTable = tableMatch;
      
      // Ensure proper pipe character formatting (ensure spaces around content)
      processedTable = processedTable.replace(/\|([^\|\n\r]+?)\|/g, '| $1 |');
      processedTable = processedTable.replace(/\|\s{2,}/g, '| ');
      processedTable = processedTable.replace(/\s{2,}\|/g, ' |');
      
      // Ensure the header separator row has proper dashes and alignment indicators
      // Look for patterns like: | Header | Header |
      const headerRowPattern = /\|(.*?)\|\n\|(?:[^-:\|\n]*?)\|/;
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
  
  // If the text doesn't already have bold or italic formatting,
  // selectively add some emphasis to important phrases specific to reflection
  if (!formatted.includes('**') && !formatted.includes('*')) {
    // Add bold to phrases indicating importance or reflection
    const emphasisPhrases = [
      'insight', 'lesson', 'learned', 'reflection', 'hindsight',
      'improvement', 'mistake', 'success', 'strength', 'weakness', 
      'opportunity', 'challenge', 'perspective', 'pattern', 'bias'
    ];
    
    emphasisPhrases.forEach(phrase => {
      // Use a regex that ensures we don't match partial words
      const regex = new RegExp(`\\b(${phrase})\\b`, 'gi');
      formatted = formatted.replace(regex, '**$1**');
    });
  }
  
  // Format confidence statements 
  formatted = formatted.replace(/(\d+)% confidence/gi, '**$1% confidence**');
  
  return formatted;
}

/**
 * Reflect component for displaying retrospective analysis
 */
export function ReflectComponent({ 
  topic = "", 
  reflection = "", 
  confidence 
}: ReflectComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';
  
  // Format reflection with enhanced markdown
  const formattedReflection = formatReflectionContent(reflection);
  
  // Add confidence indicator if provided and valid
  let confidenceIndicator = '';
  if (confidence !== undefined && confidence !== null && typeof confidence === 'number' && !isNaN(confidence)) {
    confidenceIndicator = `\n\n*Confidence: ${(confidence * 100).toFixed(1)}%*`;
  }
  
  // Construct the title with the topic if provided
  const title = safeTopicText 
    ? `## 🔍 Reflecting on: ${safeTopicText}`
    : `## 🔍 Retrospective Analysis`;
  
  // Special case for the "reflecting" state
  if (formattedReflection === 'Reflecting...') {
    return createToolResult(
      'reflect_result',
      `${title}\n\n${formattedReflection}`
    );
  }
  
  // Return the complete reflection with enhanced markdown formatting
  return createToolResult(
    'reflect_result',
    `${title}\n\n${formattedReflection}${confidenceIndicator}`
  );
} 