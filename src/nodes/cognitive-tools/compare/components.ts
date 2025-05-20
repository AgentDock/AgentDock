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
 * Minimal formatting function - primarily ensures the text is trimmed.
 */
function formatComparisonContent(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Handle the legacy analyzing state just in case
  if (text === 'Analyzing...' || text === 'Comparing...') {
    return text;
  }

  // Trim whitespace, but avoid other modifications.
  return text.trim();
}

/**
 * Compare component for displaying structured comparisons
 */
export function CompareComponent({ topic = '', comparison = '' }: CompareComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';

  // Apply minimal formatting (just trimming)
  const formattedComparison = formatComparisonContent(comparison);

  // Construct the title with the topic if provided
  const title = safeTopicText
    ? `## ⚖️ Comparing: ${safeTopicText}` // Updated Icon
    : `## ⚖️ Structured Comparison`; // Updated Icon

  // Handle the legacy analyzing state
  if (formattedComparison === 'Analyzing...' || formattedComparison === 'Comparing...') {
    return createToolResult('compare_result', `${title}\n\n${formattedComparison}`);
  }

  // Return the title and the trimmed comparison content.
  return createToolResult('compare_result', `${title}\n\n${formattedComparison}`);
}
