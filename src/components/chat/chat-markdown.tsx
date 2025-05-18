'use client';

import React, { useRef, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/ui/copy-button';
import { MermaidDiagram } from '@/components/ui/mermaid-diagram';
import { CodeBlock, childrenTakeAllStringContents } from '@/components/ui/markdown-renderer';
import { MermaidSkeleton } from './ChatSkeleton';

interface ChatMarkdownProps {
  children: string;
  isStreaming?: boolean;
  messageId?: string | number;
}

/**
 * A specialized markdown renderer for chat messages
 * This ensures that markdown styles don't leak into the global scope
 */
export function ChatMarkdown({ children, isStreaming = false, messageId }: ChatMarkdownProps) {
  // Track if this message is already fully rendered (with all mermaid diagrams)
  const [isFullyRendered, setIsFullyRendered] = useState(false);
  // Track previous content length to detect streaming additions
  const prevContentLengthRef = useRef<number>(0);
  // Store the final content once rendered to prevent re-renders
  const [finalContent, setFinalContent] = useState<string | null>(null);
  // Stable reference to the messageId for diagram rendering
  const messageIdRef = useRef<string | number | undefined>(messageId);

  // Process streaming content and mermaid diagrams
  useEffect(() => {
    // Keep stable reference to messageId
    messageIdRef.current = messageId;

    // When streaming starts, reset fully rendered state
    if (isStreaming) {
      setIsFullyRendered(false);
    }

    // Only freeze content when transitioning from streaming to not streaming
    if (!isStreaming && finalContent !== children) {
      // Mark this message as fully rendered - will never be touched again
      setIsFullyRendered(true);
      // Store the final content to freeze it for future renders
      setFinalContent(children);
      // Reset the content length tracker
      prevContentLengthRef.current = 0;
    }

    // Update the previous content length to track streaming
    prevContentLengthRef.current = children.length;
  }, [isStreaming, children, finalContent, messageId]);

  // When streaming, use the actual streaming content (children)
  // When not streaming, use the frozen content if available
  const contentToRender = isStreaming ? children : finalContent || children;

  // Empty check
  if (!contentToRender || contentToRender.trim() === '') {
    return null;
  }

  // Define custom components for chat markdown
  const chatComponents: Components = {
    // Text elements
    p: ({ children, ...props }) => (
      <p className="mb-3 leading-relaxed last:mb-0" {...props}>
        {children}
      </p>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-semibold mt-4 mb-2 leading-tight" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-semibold mt-4 mb-2 leading-tight" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-semibold mt-3 mb-2 leading-snug" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-base font-semibold mt-3 mb-2" {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5 className="text-base font-semibold mt-3 mb-2" {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6 className="text-base font-semibold mt-3 mb-2" {...props}>
        {children}
      </h6>
    ),

    // Styling elements
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,

    // Lists
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-6 my-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-6 my-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="mb-1 relative" {...props}>
        {children}
      </li>
    ),

    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="even:bg-gray-50 dark:even:bg-gray-800">{children}</tr>,
    th: ({ children }) => (
      <th className="border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-200 dark:border-gray-700 p-2">{children}</td>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        className="text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-800 dark:hover:text-blue-300"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),

    // Code handling for mermaid and code highlighting
    code: ({ node, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1].split(':')[0] : ''; // Extract base language, removing any ID
      const content = childrenTakeAllStringContents(children);

      // Generate a stable id for this code block based on content and message
      const codeId = `${messageIdRef.current || 'code'}-${content.substring(0, 20).replace(/\W/g, '')}`;

      // Handle mermaid diagrams
      if (language === 'mermaid') {
        // Always use a container with fixed dimensions to prevent layout shifts
        return (
          <div className="relative min-h-[100px] my-4 w-full">
            {/* Only render the actual diagram when not streaming or when fully rendered */}
            {isFullyRendered || !isStreaming ? (
              <MermaidDiagram key={codeId} content={content} />
            ) : (
              // During streaming, use a skeleton with the same dimensions
              <MermaidSkeleton key={codeId} />
            )}
          </div>
        );
      }

      // Check if this is a code block (inside a pre) or an inline code element
      const isCodeBlock =
        node?.position?.start?.line !== node?.position?.end?.line ||
        (node?.parent?.type === 'element' && node?.parent?.tagName === 'pre');

      // For code blocks vs inline code
      return isCodeBlock ? (
        <div className="my-3" key={codeId}>
          <CodeBlock className={className} language={language} {...props}>
            {children}
          </CodeBlock>
        </div>
      ) : (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Pre handling
    pre: ({ children }) => <div className="my-0 p-0">{children}</div>,

    // Misc elements
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-gray-200 dark:border-gray-700 pl-4 my-3 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-t border-gray-200 dark:border-gray-700 my-4" />,
    br: () => <br className="h-3" />,
  };

  return (
    <div className="leading-normal">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={chatComponents}
      >
        {contentToRender}
      </Markdown>
    </div>
  );
}

ChatMarkdown.displayName = 'ChatMarkdown';
