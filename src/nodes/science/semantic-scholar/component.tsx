/**
 * @fileoverview React components for displaying Semantic Scholar results
 */

import React from 'react';

/**
 * Author interface
 */
export interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  url?: string;
  affiliations?: string[];
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}

/**
 * Paper interface
 */
export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  url: string;
  year?: number;
  venue?: string;
  publicationDate?: string;
  authors: SemanticScholarAuthor[];
  citationCount?: number;
  referenceCount?: number;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  fieldsOfStudy?: string[];
  tldr?: {
    text: string;
  };
  externalIds?: Record<string, string>;
}

/**
 * Search result interface
 */
export interface SemanticScholarSearchResult {
  query: string;
  total: number;
  offset: number;
  papers: SemanticScholarPaper[];
  searchParams: {
    year?: number;
    venue?: string;
    openAccess?: boolean;
    fieldsOfStudy?: string;
  };
}

/**
 * Component for displaying Semantic Scholar search results
 */
export const SemanticScholarSearchResultComponent: React.FC<{
  result: SemanticScholarSearchResult;
}> = ({ result }) => {
  return (
    <div className="semantic-scholar-search-result">
      <h3>Semantic Scholar Search Results for &quot;{result.query}&quot;</h3>
      <p>Found {result.total} results</p>

      {result.searchParams.year && <p>Year: {result.searchParams.year}</p>}

      {result.searchParams.venue && <p>Venue: {result.searchParams.venue}</p>}

      {result.searchParams.openAccess && <p>Open Access Only</p>}

      {result.searchParams.fieldsOfStudy && (
        <p>Field of Study: {result.searchParams.fieldsOfStudy}</p>
      )}

      <ul>
        {result.papers.map((paper, index) => (
          <li key={paper.paperId || index}>
            <div>
              <strong>{paper.title}</strong>
              {paper.authors.length > 0 && (
                <p>
                  <em>
                    {paper.authors.map((author) => author.name).join(', ')}
                  </em>
                </p>
              )}
              {paper.venue && <p>Venue: {paper.venue}</p>}
              <p>
                {paper.year && `Published: ${paper.year}`}
                {paper.citationCount !== undefined &&
                  ` | Citations: ${paper.citationCount}`}
              </p>
              <p>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Semantic Scholar
                </a>
                {paper.openAccessPdf && (
                  <>
                    {' | '}
                    <a
                      href={paper.openAccessPdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PDF
                    </a>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Component for displaying a single Semantic Scholar paper
 */
export const SemanticScholarPaperComponent: React.FC<{
  paper: SemanticScholarPaper;
}> = ({ paper }) => {
  return (
    <div className="semantic-scholar-paper">
      <h3>{paper.title}</h3>

      {paper.authors.length > 0 && (
        <p>
          <strong>Authors:</strong>{' '}
          {paper.authors.map((author) => author.name).join(', ')}
        </p>
      )}

      {paper.venue && (
        <p>
          <strong>Venue:</strong> {paper.venue}
        </p>
      )}

      {paper.year && (
        <p>
          <strong>Year:</strong> {paper.year}
        </p>
      )}

      {paper.publicationDate && (
        <p>
          <strong>Publication Date:</strong> {paper.publicationDate}
        </p>
      )}

      {paper.citationCount !== undefined && (
        <p>
          <strong>Citations:</strong> {paper.citationCount}
        </p>
      )}

      {paper.referenceCount !== undefined && (
        <p>
          <strong>References:</strong> {paper.referenceCount}
        </p>
      )}

      {paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0 && (
        <p>
          <strong>Fields of Study:</strong> {paper.fieldsOfStudy.join(', ')}
        </p>
      )}

      {paper.abstract && (
        <div>
          <h4>Abstract</h4>
          <p>{paper.abstract}</p>
        </div>
      )}

      {paper.tldr && (
        <div>
          <h4>TL;DR</h4>
          <p>
            <em>{paper.tldr.text}</em>
          </p>
        </div>
      )}

      <p>
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Semantic Scholar
        </a>
        {paper.openAccessPdf && (
          <>
            {' | '}
            <a
              href={paper.openAccessPdf.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download PDF
            </a>
          </>
        )}
      </p>

      {paper.externalIds && paper.externalIds.DOI && (
        <p>
          <a
            href={`https://doi.org/${paper.externalIds.DOI}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            DOI: {paper.externalIds.DOI}
          </a>
        </p>
      )}
    </div>
  );
};

/**
 * Component for displaying a Semantic Scholar author
 */
export const SemanticScholarAuthorComponent: React.FC<{
  author: SemanticScholarAuthor;
}> = ({ author }) => {
  return (
    <div className="semantic-scholar-author">
      <h3>{author.name}</h3>

      {author.affiliations && author.affiliations.length > 0 && (
        <p>
          <strong>Affiliations:</strong> {author.affiliations.join(', ')}
        </p>
      )}

      {author.paperCount !== undefined && (
        <p>
          <strong>Papers:</strong> {author.paperCount}
        </p>
      )}

      {author.citationCount !== undefined && (
        <p>
          <strong>Citations:</strong> {author.citationCount}
        </p>
      )}

      {author.hIndex !== undefined && (
        <p>
          <strong>h-index:</strong> {author.hIndex}
        </p>
      )}

      {author.url && (
        <p>
          <a
            href={author.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Semantic Scholar
          </a>
        </p>
      )}
    </div>
  );
};
