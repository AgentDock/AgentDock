'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import '../components/styles.css';
import type { CritiqueParameters } from './schema';

/**
 * Minimal formatting function - primarily ensures the text is trimmed.
 * Removed complex formatting logic.
 */
const formatCritique = (analysis: string): string => {
  if (!analysis || typeof analysis !== 'string') return '';
  // Trim whitespace, but avoid other modifications.
  return analysis.trim();
};

/**
 * Critique Tool Component
 * Updated to work directly with ChatMarkdown - no dangerous HTML.
 */
export const CritiqueComponent: React.FC<CritiqueParameters> = ({ subject, analysis }) => {
  // Apply minimal formatting (just trimming)
  const formattedAnalysis = formatCritique(analysis);

  // Construct the title
  const title = `## 🔍 Critique of: ${subject}`;

  // Combine title and analysis into a single Markdown string
  const markdownContent = `${title}\n\n${formattedAnalysis}`;

  // This component now expects its output to be rendered by ChatMarkdown.
  // We return the raw markdown string, typically wrapped by a ToolResult elsewhere.
  // For direct usage in React, you would pass markdownContent to <ChatMarkdown>

  // In the context of the tool's execute function, this should be wrapped:
  // return createToolResult('critique_result', markdownContent);

  // Placeholder: Returning JSX for clarity, but the tool should return a ToolResult
  // with the markdownContent string.
  return (
    <div className="cognitive-tool-placeholder">
      {/* This is just a representation. The actual output is markdownContent */}
      {markdownContent}
    </div>
  );
};
