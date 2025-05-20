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
}

/**
 * Minimal formatting function - primarily ensures the text is trimmed.
 * All complex Markdown rendering is deferred to the main ChatMarkdown component.
 */
function formatReasoningContent(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Handle the legacy analyzing state just in case
  if (text === 'Analyzing...') {
    return text;
  }

  // Trim whitespace, but avoid other modifications.
  // Let ChatMarkdown handle spacing, emphasis, tables, etc.
  return text.trim();
}

/**
 * Think component for displaying structured reasoning
 */
export function ThinkComponent({ topic = '', reasoning = '' }: ThinkComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';

  // Apply minimal formatting (just trimming)
  const formattedReasoning = formatReasoningContent(reasoning);

  // Construct the title with the topic if provided
  const title = safeTopicText
    ? `## 🧠 Thinking about: ${safeTopicText}`
    : `## 🧠 Structured Reasoning`;

  // Handle the legacy analyzing state
  if (formattedReasoning === 'Analyzing...') {
    return createToolResult('think_result', `${title}\n\n${formattedReasoning}`);
  }

  // Return the title and the *unmodified* reasoning content.
  // ChatMarkdown will handle rendering lists, tables, bold, etc.
  return createToolResult(
    'think_result',
    `${title}\n\n${formattedReasoning}`, // Pass the trimmed reasoning directly
  );
}
