"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
import "../components/styles.css"
import type { CritiqueParameters } from "./schema"

/**
 * Formats critique analysis with semantic markup
 */
const formatCritique = (analysis: string): string => {
  // Add semantic class names to different sections
  return analysis
    // Format the section headers
    .replace(/UNDERSTANDING:/g, '<span class="font-semibold text-foreground">UNDERSTANDING:</span>')
    .replace(/STRENGTHS:/g, '<span class="font-semibold text-foreground">STRENGTHS:</span>')
    .replace(/ISSUES:/g, '<span class="font-semibold text-foreground">ISSUES:</span>')
    .replace(/SUGGESTIONS:/g, '<span class="font-semibold text-foreground">SUGGESTIONS:</span>')
    .replace(/OVERALL ASSESSMENT:/g, '<span class="font-semibold text-foreground">OVERALL ASSESSMENT:</span>')
    
    // Format numbered items
    .replace(/(\d+\.\s)([^:\n]+)(?=\n|$)/g, (match, number, content) => {
      if (match.includes("STRENGTHS:")) return match;
      
      // Different styling based on the section
      if (analysis.indexOf("STRENGTHS:") !== -1 && 
          analysis.indexOf("STRENGTHS:") < analysis.indexOf(match) && 
          (analysis.indexOf("ISSUES:") === -1 || analysis.indexOf("ISSUES:") > analysis.indexOf(match))) {
        return `${number}<span class="critique-strength">${content}</span>`;
      } else if (analysis.indexOf("ISSUES:") !== -1 && 
                analysis.indexOf("ISSUES:") < analysis.indexOf(match) && 
                (analysis.indexOf("SUGGESTIONS:") === -1 || analysis.indexOf("SUGGESTIONS:") > analysis.indexOf(match))) {
        return `${number}<span class="critique-issue">${content}</span>`;
      } else if (analysis.indexOf("SUGGESTIONS:") !== -1 && 
                analysis.indexOf("SUGGESTIONS:") < analysis.indexOf(match)) {
        return `${number}<span class="critique-suggestion">${content}</span>`;
      }
      
      return match;
    });
};

/**
 * Critique Tool Component
 */
export const CritiqueComponent: React.FC<CritiqueParameters> = ({ 
  subject, 
  analysis
}) => {
  const formattedAnalysis = React.useMemo(() => {
    return formatCritique(analysis);
  }, [analysis]);

  return (
    <div className="cognitive-tool-container">
      <div className="cognitive-tool-header">
        <Sparkles className="cognitive-tool-icon text-primary" />
        <span className="cognitive-tool-title">🔍 Critique of: {subject}</span>
      </div>
      <div 
        className="cognitive-tool-content"
        dangerouslySetInnerHTML={{ __html: formattedAnalysis }}
      />
    </div>
  );
};
