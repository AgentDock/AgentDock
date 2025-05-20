'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/ui/copy-button';
import { MermaidDiagram } from './mermaid-diagram';

interface MarkdownRendererProps {
  children: string;
}

interface ComponentProps {
  node?: any;
  [key: string]: any;
}

// The original, simple markdown renderer - no special styling
export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={COMPONENTS as Components}
      className="space-y-3"
    >
      {children}
    </Markdown>
  );
}

MarkdownRenderer.displayName = 'MarkdownRenderer';

interface HighlightedPreProps extends React.HTMLAttributes<HTMLPreElement> {
  children: string;
  language: string;
}

const HighlightedPre = React.memo(({ children, language, ...props }: HighlightedPreProps) => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // No theme state, use fixed dark theme for code blocks

  useEffect(() => {
    let isMounted = true;

    const loadHighlighter = async () => {
      try {
        const { codeToTokens, bundledLanguages } = await import('shiki');

        // Skip complex highlighting for directory structures
        const isDirectoryStructure = children
          .split('\n')
          .some(
            (line) =>
              line.trim().startsWith('├──') ||
              line.trim().startsWith('└──') ||
              line.trim().startsWith('│'),
          );

        if (isDirectoryStructure || !(language in bundledLanguages)) {
          if (isMounted) {
            setTokens([]);
            setIsLoading(false);
          }
          return;
        }

        // Always use dark theme for code blocks, no theme detection
        const result = await codeToTokens(children, {
          lang: language as keyof typeof bundledLanguages,
          theme: 'github-dark', // Always dark theme, no switching
        });

        if (isMounted) {
          setTokens(result.tokens);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading syntax highlighter:', error);
        if (isMounted) {
          setTokens([]);
          setIsLoading(false);
        }
      }
    };

    loadHighlighter();

    return () => {
      isMounted = false;
    };
  }, [children, language]);

  if (isLoading || tokens.length === 0) {
    return (
      <pre {...props}>
        <code className="whitespace-pre">{children}</code>
      </pre>
    );
  }

  return (
    <pre {...props}>
      <code className="whitespace-pre">
        {tokens.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            <span>
              {line.map((token: any, tokenIndex: number) => (
                <span key={tokenIndex} style={{ color: token.color }}>
                  {token.content}
                </span>
              ))}
            </span>
            {lineIndex !== tokens.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </code>
    </pre>
  );
});

HighlightedPre.displayName = 'HighlightedPre';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
  className?: string;
  language: string;
}

export const CodeBlock = ({ children, className, language, ...restProps }: CodeBlockProps) => {
  const code = typeof children === 'string' ? children : childrenTakeAllStringContents(children);

  // Ensure directory structures are properly formatted
  // If the language is undefined or empty and the content looks like a directory structure,
  // set the language to "plaintext" to ensure proper formatting
  const detectedLanguage =
    language ||
    (code.includes('/') &&
    code
      .split('\n')
      .some(
        (line) =>
          line.trim().startsWith('├──') ||
          line.trim().startsWith('└──') ||
          line.trim().startsWith('│'),
      )
      ? 'plaintext'
      : 'text');

  const preClass = cn(
    'overflow-x-scroll rounded-md border bg-muted/80 dark:bg-slate-900 p-4 font-mono text-sm [scrollbar-width:none]',
    className,
  );

  return (
    <div className="group/code relative mb-4">
      <Suspense
        fallback={
          <pre className={preClass} {...restProps}>
            <code className="whitespace-pre">{code}</code>
          </pre>
        }
      >
        <HighlightedPre language={detectedLanguage} className={preClass}>
          {code}
        </HighlightedPre>
      </Suspense>

      <div className="absolute right-2 top-2 opacity-80 transition-opacity duration-200 group-hover/code:opacity-100">
        <CopyButton content={code} copyMessage="Copied code to clipboard" size="small" />
      </div>
    </div>
  );
};

CodeBlock.displayName = 'CodeBlock';

export function childrenTakeAllStringContents(element: any): string {
  if (typeof element === 'string') {
    return element;
  }

  if (element?.props?.children) {
    const children = element.props.children;

    if (Array.isArray(children)) {
      return children.map((child) => childrenTakeAllStringContents(child)).join('');
    } else {
      return childrenTakeAllStringContents(children);
    }
  }

  return '';
}

// Helper function to format link text
function formatLinkText(text: string): string {
  // Remove .md extension if present
  let formattedText = text.replace(/\.md$/, '');

  // Handle kebab-case: replace hyphens with spaces and capitalize each word
  if (formattedText.includes('-')) {
    formattedText = formattedText
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return formattedText;
}

const COMPONENTS = {
  h1: withClass('h1', 'text-2xl font-semibold'),
  h2: withClass('h2', 'font-semibold text-xl'),
  h3: withClass('h3', 'font-semibold text-lg'),
  h4: withClass('h4', 'font-semibold text-base'),
  h5: withClass('h5', 'font-medium'),
  strong: withClass('strong', 'font-semibold'),
  // Use actual BR element with improved styling
  br: () => <br style={{ marginBottom: '0.75rem' }} />,
  a: ({ node, href, children, ...props }: ComponentProps) => {
    // NOTE: 'node' is intentionally used here by react-markdown's component API
    // but we don't spread it below.
    const messageClasses =
      'text-blue-600 dark:text-blue-400 font-medium underline underline-offset-2 break-all hover:text-blue-800 dark:hover:text-blue-300 [.bg-primary_&]:text-blue-100 [.bg-primary_&]:hover:text-white [.bg-primary_&]:font-semibold [.bg-muted_&]:text-blue-600';

    // Format link text for .md files
    let linkContent = children;
    let processedHref = href;

    if (typeof href === 'string') {
      // Handle README.md links - remove README.md and just use directory path
      if (href.toLowerCase().endsWith('/readme.md')) {
        processedHref = href.replace(/\/readme\.md$/i, '');
      }

      // Handle other .md links by removing the extension
      else if (href.endsWith('.md')) {
        processedHref = href.replace(/\.md$/, '');
      }
    }

    if (typeof children === 'string' && href?.endsWith('.md')) {
      linkContent = formatLinkText(children as string);
    }

    // Check if this is an internal link (starts with /)
    const isInternalLink = typeof processedHref === 'string' && processedHref.startsWith('/');

    if (isInternalLink) {
      return (
        <Link href={processedHref} className={messageClasses} {...props}>
          {linkContent}
        </Link>
      );
    }

    return (
      <a href={processedHref} className={messageClasses} {...props}>
        {linkContent}
      </a>
    );
  },
  pre: ({ children }: any) => children, // 'node' is implicitly handled by the 'code' component
  code: ({ node, className, children, ...props }: ComponentProps) => {
    // NOTE: 'node' is intentionally used here by react-markdown's component API
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    // Check if this is a code block (inside a pre) or an inline code element
    const isCodeBlock =
      node?.position?.start?.line !== node?.position?.end?.line ||
      (node?.parent?.type === 'element' && node?.parent?.tagName === 'pre');

    // If it's a mermaid diagram, use the MermaidDiagram component
    if (language === 'mermaid') {
      let content = '';
      if (typeof children === 'string') {
        content = children;
      } else {
        content = childrenTakeAllStringContents(children);
      }
      // Return the MermaidDiagram directly without the wrapper div that was causing issues
      return <MermaidDiagram content={content} />;
    }

    // For code blocks vs inline code
    return isCodeBlock ? (
      // Pass {...props} excluding node to CodeBlock if needed, but CodeBlock doesn't seem to use random props
      <CodeBlock className={className} language={language}>
        {children}
      </CodeBlock>
    ) : (
      // For inline code, don't spread potentially problematic props like 'node'
      <code
        className={cn(
          'font-mono [:not(pre)>&]:rounded-md [:not(pre)>&]:bg-background/50 [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5',
        )}
        // Only pass known/safe props if necessary, or none if props are just children/className
        // {...props} <- Removed spread
      >
        {children}
      </code>
    );
  },
  ol: ({ node, children, ...props }: ComponentProps) => {
    // Destructure node
    return (
      <ol className="list-decimal pl-6 marker:text-neutral-700" {...props}>
        {' '}
        {/* Spread remaining props */}
        {children}
      </ol>
    );
  },
  ul: ({ node, children, ...props }: ComponentProps) => {
    // Destructure node
    return (
      <ul className="list-disc pl-6 marker:text-neutral-700" {...props}>
        {' '}
        {/* Spread remaining props */}
        {children}
      </ul>
    );
  },
  li: ({ node, children, ...props }: ComponentProps) => {
    // Destructure node
    return (
      <li className="my-1" {...props}>
        {' '}
        {/* Spread remaining props */}
        {children}
      </li>
    );
  },
  p: ({ node, children, ...props }: ComponentProps) => {
    // Destructure node
    return (
      <p {...props}>{children}</p> // Spread remaining props
    );
  },
  hr: withClass('hr', 'border-foreground/20'),
};

function withClass(Tag: keyof React.JSX.IntrinsicElements, classes: string) {
  // Modify the HOC to destructure 'node' and exclude it from spreading
  const Component = ({ node, ...props }: ComponentProps) => {
    const elementProps = {
      className: classes,
      ...props, // Spread only the remaining props, excluding 'node'
    };
    return React.createElement(Tag, elementProps);
  };
  Component.displayName = Tag;
  return Component;
}

export default MarkdownRenderer;
