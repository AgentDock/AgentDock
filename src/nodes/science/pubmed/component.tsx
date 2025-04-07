'use client';

import React from 'react';

/**
 * PubMed article type with all necessary fields for display
 */
export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal?: string;
  pubDate?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  keywords?: string[];
}

/**
 * Props for the PubMedSearchResult component
 */
interface PubMedSearchResultProps {
  articles: PubMedArticle[];
  query: string;
  total?: number;
}

/**
 * Simple date formatting helper
 */
function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Component to display PubMed search results
 */
export function PubMedSearchResult({ articles, query, total }: PubMedSearchResultProps) {
  if (!articles || articles.length === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-md">
        <h3 className="font-semibold mb-2">PubMed Search: &quot;{query}&quot;</h3>
        <p>No results found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 rounded-md">
      <h3 className="font-semibold mb-2">
        PubMed Search: &quot;{query}&quot; ({total ? `${articles.length} of ${total}` : articles.length} results)
      </h3>
      <div className="space-y-4 mt-3">
        {articles.map((article) => (
          <div key={article.pmid} className="border border-border p-3 rounded-md bg-white dark:bg-zinc-900">
            <h4 className="font-medium text-md">{article.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {article.authors.slice(0, 3).join(', ')}
              {article.authors.length > 3 ? ` and ${article.authors.length - 3} more` : ''}
            </p>
            {article.journal && (
              <p className="mt-1 text-xs text-muted-foreground">
                {article.journal} {article.pubDate && `(${formatDate(new Date(article.pubDate))})`}
              </p>
            )}
            {article.abstract && (
              <div className="mt-2 text-sm">
                <p className="line-clamp-3">{article.abstract}</p>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View on PubMed
                </a>
              )}
              {article.doi && (
                <a
                  href={`https://doi.org/${article.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  DOI: {article.doi}
                </a>
              )}
              <span className="text-xs text-muted-foreground">PMID: {article.pmid}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Props for the PubMedArticleDetail component
 */
interface PubMedArticleDetailProps {
  article: PubMedArticle;
}

/**
 * Component to display a single PubMed article in detail
 */
export function PubMedArticleDetail({ article }: PubMedArticleDetailProps) {
  if (!article) {
    return (
      <div className="p-4 bg-muted/30 rounded-md">
        <p>Article not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 rounded-md">
      <h3 className="font-semibold mb-2">{article.title}</h3>
      <p className="mt-1 text-sm">
        {article.authors.join(', ')}
      </p>
      {article.journal && (
        <p className="mt-1 text-sm text-muted-foreground">
          {article.journal} {article.pubDate && `(${formatDate(new Date(article.pubDate))})`}
        </p>
      )}
      {article.abstract && (
        <div className="mt-3 text-sm">
          <h4 className="font-medium mb-1">Abstract</h4>
          <p>{article.abstract}</p>
        </div>
      )}
      {article.keywords && article.keywords.length > 0 && (
        <div className="mt-3">
          <h4 className="font-medium mb-1 text-sm">Keywords</h4>
          <div className="flex flex-wrap gap-1">
            {article.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="text-xs bg-muted px-2 py-1 rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-3">
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View on PubMed
          </a>
        )}
        {article.doi && (
          <a
            href={`https://doi.org/${article.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            DOI: {article.doi}
          </a>
        )}
        <span className="text-sm text-muted-foreground">PMID: {article.pmid}</span>
      </div>
    </div>
  );
} 