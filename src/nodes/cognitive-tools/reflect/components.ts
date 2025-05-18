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
}

/**
 * Minimal formatting function - primarily ensures the text is trimmed.
 */
function formatReflectionContent(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Handle the legacy analyzing state just in case
  if (text === 'Reflecting...') {
    return text;
  }

  // Trim whitespace, but avoid other modifications.
  return text.trim();
}

/**
 * Reflect component for displaying retrospective analysis
 */
export function ReflectComponent({ topic = '', reflection = '' }: ReflectComponentProps) {
  // Ensure topic is always a string
  const safeTopicText = typeof topic === 'string' ? topic : '';

  // Apply minimal formatting (just trimming)
  const formattedReflection = formatReflectionContent(reflection);

  // Construct the title with the topic if provided
  const title = safeTopicText
    ? `## 🔍 Reflecting on: ${safeTopicText}`
    : `## 🔍 Retrospective Analysis`;

  // Handle the legacy analyzing state
  if (formattedReflection === 'Reflecting...') {
    return createToolResult('reflect_result', `${title}\n\n${formattedReflection}`);
  }

  // Return the title and the trimmed reflection content.
  return createToolResult('reflect_result', `${title}\n\n${formattedReflection}`);
}
