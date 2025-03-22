/**
 * @fileoverview Think Tool UI components for rendering structured reasoning.
 * These components provide a clean interface for displaying AI reasoning.
 */

import { createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Think component interface
 */
export interface ThinkComponentProps {
  topic?: string;
  reasoning: string; 
  confidence?: number;
}

/**
 * Format reasoning for better readability while preserving and enhancing Markdown formatting
 */
function formatReasoningContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Special case for the analyzing state
  if (text === 'Analyzing...') {
    return text;
  }
  
  let formatted = text;
  
  // Ensure proper spacing for list items (both numbered and bullet points)
  formatted = formatted.replace(/^(\d+\.\s)/gm, '\n$1');
  formatted = formatted.replace(/^([-*]\s)/gm, '\n$1');
  
  // Ensure heading tags have proper spacing
  formatted = formatted.replace(/^(#{1,6}\s)/gm, '\n$1');
  
  // Enhance blockquote formatting
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
  // selectively add some emphasis to important phrases
  if (!formatted.includes('**') && !formatted.includes('*')) {
    // Add bold to phrases indicating importance or conclusion
    const emphasisPhrases = [
      'important', 'critical', 'key factor', 'essential', 'significant', 
      'conclusion', 'therefore', 'thus', 'result', 'ultimately', 'in summary'
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
 * Think component for displaying structured reasoning
 */
export function ThinkComponent({ 
  topic = "", 
  reasoning = "", 
  confidence 
}: ThinkComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';
  
  // Format reasoning with enhanced markdown
  const formattedReasoning = formatReasoningContent(reasoning);
  
  // Add confidence indicator if provided and valid
  let confidenceIndicator = '';
  if (confidence !== undefined && confidence !== null && typeof confidence === 'number' && !isNaN(confidence)) {
    confidenceIndicator = `\n\n*Confidence: ${(confidence * 100).toFixed(1)}%*`;
  }
  
  // Construct the title with the topic if provided
  const title = safeTopicText 
    ? `## 🧠 Thinking about: ${safeTopicText}`
    : `## 🧠 Structured Reasoning`;
  
  // Special case for the analyzing state
  if (formattedReasoning === 'Analyzing...') {
    return createToolResult(
      'think_result',
      `${title}\n\n${formattedReasoning}`
    );
  }
  
  // Return the complete reasoning with enhanced markdown formatting
  return createToolResult(
    'think_result',
    `${title}\n\n${formattedReasoning}${confidenceIndicator}`
  );
} 