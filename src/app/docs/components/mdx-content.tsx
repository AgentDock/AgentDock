'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface MDXContentProps {
  source: string;
  className?: string;
}

export default function MDXContent({ source, className }: MDXContentProps) {
  return (
    <div className={cn('prose prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold tracking-tight mt-2 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold tracking-tight mt-10 mb-4">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-4">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold tracking-tight mt-6 mb-2">{children}</h4>
          ),
          p: ({ children }) => <p className="leading-7 mb-4">{children}</p>,
          a: ({ href, children }) => {
            if (!href) return <>{children}</>;

            const isExternal = href.startsWith('http');
            if (isExternal) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {children}
                </a>
              );
            }

            return (
              <a
                href={href}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
          li: ({ children }) => <li className="mt-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-6 border-l-2 pl-6 italic">{children}</blockquote>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 mt-4 overflow-x-auto bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="bg-slate-100 dark:bg-slate-800 p-1 rounded text-sm">{children}</code>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
