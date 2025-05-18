'use client';

import * as React from 'react';
import { Lightbulb } from 'lucide-react';
import '../components/styles.css';

/**
 * Interface for the brainstorm parameters
 */
export interface BrainstormParameters {
  /**
   * The challenge being brainstormed
   */
  challenge: string;

  /**
   * The structured collection of ideas
   */
  ideas: string;
}

/**
 * Formats brainstorm ideas with semantic markup
 */
const formatBrainstorm = (ideas: string): string => {
  if (!ideas) return '';

  // Add semantic class names to different sections
  return (
    ideas
      // Format the section headers
      .replace(
        /PROBLEM FRAMING:/g,
        '<span class="font-semibold text-foreground">PROBLEM FRAMING:</span>',
      )
      .replace(
        /CATEGORY (\d+):/g,
        '<span class="font-semibold text-foreground">CATEGORY $1:</span>',
      )
      .replace(/IDEAS:/g, '<span class="font-semibold text-foreground">IDEAS:</span>')
      .replace(
        /POTENTIAL APPLICATIONS:/g,
        '<span class="font-semibold text-foreground">POTENTIAL APPLICATIONS:</span>',
      )
      .replace(/KEY INSIGHTS:/g, '<span class="font-semibold text-foreground">KEY INSIGHTS:</span>')
      .replace(/NEXT STEPS:/g, '<span class="font-semibold text-foreground">NEXT STEPS:</span>')

      // Format numbered items
      .replace(/(\d+\.\s)([^:\n]+)(?=\n|$)/g, (match, number, content) => {
        // Different styling based on the section
        if (
          ideas.indexOf('IDEAS:') !== -1 &&
          ideas.indexOf('IDEAS:') < ideas.indexOf(match) &&
          (ideas.indexOf('POTENTIAL APPLICATIONS:') === -1 ||
            ideas.indexOf('POTENTIAL APPLICATIONS:') > ideas.indexOf(match))
        ) {
          return `${number}<span class="brainstorm-idea">${content}</span>`;
        } else if (
          ideas.indexOf('NEXT STEPS:') !== -1 &&
          ideas.indexOf('NEXT STEPS:') < ideas.indexOf(match)
        ) {
          return `${number}<span class="brainstorm-next-step">${content}</span>`;
        } else if (
          ideas.indexOf('KEY INSIGHTS:') !== -1 &&
          ideas.indexOf('KEY INSIGHTS:') < ideas.indexOf(match) &&
          (ideas.indexOf('NEXT STEPS:') === -1 ||
            ideas.indexOf('NEXT STEPS:') > ideas.indexOf(match))
        ) {
          return `${number}<span class="brainstorm-insight">${content}</span>`;
        }

        return match;
      })
  );
};

/**
 * Brainstorm Tool Component
 */
export const BrainstormComponent: React.FC<BrainstormParameters> = ({ challenge, ideas }) => {
  const formattedIdeas = React.useMemo(() => {
    return formatBrainstorm(ideas);
  }, [ideas]);

  return (
    <div className="cognitive-tool-container">
      <div className="cognitive-tool-header">
        <Lightbulb className="cognitive-tool-icon text-primary" />
        <span className="cognitive-tool-title">💡 Brainstorm: {challenge}</span>
      </div>
      <div
        className="cognitive-tool-content"
        dangerouslySetInnerHTML={{ __html: formattedIdeas }}
      />
    </div>
  );
};
