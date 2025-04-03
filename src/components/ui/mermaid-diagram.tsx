'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import panzoom from 'panzoom';

interface MermaidDiagramProps {
  content: string;
}

// Simple function to detect diagram type for better styling
function getDiagramType(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('graph') || trimmed.startsWith('flowchart')) return 'flowchart';
  if (trimmed.startsWith('sequenceDiagram')) return 'sequence';
  if (trimmed.startsWith('classDiagram')) return 'class';
  if (trimmed.startsWith('stateDiagram')) return 'state';
  if (trimmed.startsWith('erDiagram')) return 'er';
  if (trimmed.startsWith('journey')) return 'journey';
  if (trimmed.startsWith('gantt')) return 'gantt';
  if (trimmed.startsWith('pie')) return 'pie';
  return 'default';
}

// Simple function to detect if diagram is vertical
function isVerticalLayout(content: string): boolean {
  return content.includes('TD') || content.includes('TB');
}

// We use a singleton approach to prevent multiple initializations
let mermaidInitialized = false;

export function MermaidDiagram({ content }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Generate a unique ID for each diagram to prevent conflicts
  const [svgId] = useState(`mermaid-${Math.random().toString(36).substring(2, 11)}`);
  const panzoomInstanceRef = useRef<ReturnType<typeof panzoom> | null>(null);
  const isVertical = isVerticalLayout(content);

  // Initialize mermaid once
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
      mermaidInitialized = true;
    }
    
    // Cleanup on unmount - remove any error elements
    return () => {
      if (panzoomInstanceRef.current) {
        panzoomInstanceRef.current.dispose();
        panzoomInstanceRef.current = null;
      }
      
      // Clean up any error elements
      document.querySelectorAll('body > [id*="mermaid-err"]').forEach(el => {
        if (el.parentNode === document.body) {
          el.remove();
        }
      });
    };
  }, []);

  // Function to render the diagram
  const renderDiagram = async () => {
    if (!containerRef.current) return;
    
    try {
      // Dispose of existing panzoom instance if it exists
      if (panzoomInstanceRef.current) {
        panzoomInstanceRef.current.dispose();
        panzoomInstanceRef.current = null;
      }
      
      // Clear existing content and set opacity to 0 during rendering
      containerRef.current.innerHTML = '';
      containerRef.current.style.opacity = '0';
      
      // Render the diagram
      const { svg } = await mermaid.render(svgId, content);
      
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        
        // Apply styles to SVG
        const svgElement = containerRef.current.querySelector('svg');
        if (svgElement) {
          // Special handling for vertical diagrams
          if (isVertical) {
            svgElement.style.maxHeight = '70vh';
            svgElement.style.width = 'auto';
            svgElement.style.margin = '0 auto';
          } else {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
          }
          
          // Initialize panzoom with a slight delay to ensure rendering is complete
          setTimeout(() => {
            if (svgElement && !panzoomInstanceRef.current) {
              panzoomInstanceRef.current = panzoom(svgElement, {
                beforeWheel: (e) => {
                  // Let normal scroll happen if ctrl/cmd isn't pressed
                  const shouldZoom = e.ctrlKey || e.metaKey;
                  return !shouldZoom;
                },
                minZoom: 0.1,
                maxZoom: 10,
                zoomSpeed: 0.12
              });
              
              // Add grab cursor
              svgElement.style.cursor = 'grab';
              
              // Add event listeners for cursor style
              svgElement.addEventListener('mousedown', () => {
                svgElement.style.cursor = 'grabbing';
              });
              
              document.addEventListener('mouseup', () => {
                if (svgElement) {
                  svgElement.style.cursor = 'grab';
                }
              });
            }
            
            // Fade in the diagram
            if (containerRef.current) {
              containerRef.current.style.opacity = '1';
            }
          }, 50);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to render mermaid diagram:', err);
      setError(err instanceof Error ? err.message : String(err));
      
      // Show container even on error
      if (containerRef.current) {
        containerRef.current.style.opacity = '1';
      }
    }
  };

  // Render the diagram when component mounts or content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      renderDiagram();
    }, 50);
    
    return () => {
      clearTimeout(timeoutId);
      if (panzoomInstanceRef.current) {
        panzoomInstanceRef.current.dispose();
        panzoomInstanceRef.current = null;
      }
      
      document.removeEventListener('mouseup', () => {});
    };
  }, [content, svgId]);

  // Reset the diagram view to initial state
  const handleReset = () => {
    if (panzoomInstanceRef.current) {
      panzoomInstanceRef.current.moveTo(0, 0);
      panzoomInstanceRef.current.zoomAbs(0, 0, 1);
    }
  };

  if (error) {
    return (
      <div className="rounded-md bg-amber-50 p-4 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50">
        <p className="font-medium">Diagram rendering error</p>
        <pre className="mt-2 text-sm bg-amber-100/50 p-2 rounded overflow-auto dark:bg-amber-900/50">{error}</pre>
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      <div
        className="mermaid-container border rounded-md p-4 bg-white dark:bg-slate-900 dark:border-slate-700"
      >
        <div 
          ref={containerRef}
          className="mermaid-content"
          style={{ 
            opacity: 0,
            transition: 'opacity 0.3s ease-in'
          }}
        />
        
        {/* Reset zoom/pan button positioned at bottom right - smaller */}
        <div className="absolute bottom-3 right-3 z-10">
          <button 
            onClick={handleReset}
            className="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-md shadow-md p-1 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Reset zoom and position"
            aria-label="Reset diagram view"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M1 4v6h6"></path>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MermaidDiagram; 