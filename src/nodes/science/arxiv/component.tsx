/**
 * @fileoverview React components for displaying arXiv results
 */

import React from 'react';

/**
 * arXiv paper interface
 */
export interface ArxivPaper {
  id: string;           // arXiv ID (e.g., 2302.13971)
  title: string;        // Paper title
  summary: string;      // Abstract text
  authors: string[];    // List of author names
  categories: string[]; // List of arXiv categories
  pdfUrl: string;       // URL to PDF
  htmlUrl: string;      // URL to HTML abstract page
  published: string;    // Publication date
  updated: string;      // Last updated date
  doi?: string;         // DOI if available
  comment?: string;     // Author comment if available
  journalRef?: string;  // Journal reference if available
}

/**
 * arXiv search result interface
 */
export interface ArxivSearchResult {
  query: string;
  total: number;
  papers: ArxivPaper[];
  searchParams: {
    category?: string;
    sortBy: string;
    searchIn: string;
  };
}

/**
 * Component for displaying arXiv search results
 */
export const ArxivSearchResultComponent: React.FC<{
  result: ArxivSearchResult;
}> = ({ result }) => {
  return (
    <div className="arxiv-search-result">
      <h3>arXiv Search Results for &quot;{result.query}&quot;</h3>
      <p>Found {result.total} results</p>
      
      {result.searchParams.category && (
        <p>Category: {result.searchParams.category}</p>
      )}
      
      <ul>
        {result.papers.map((paper, index) => (
          <li key={paper.id || index}>
            <div>
              <strong>{paper.title}</strong>
              {paper.authors.length > 0 && (
                <p>
                  <em>{paper.authors.join(', ')}</em>
                </p>
              )}
              {paper.categories.length > 0 && (
                <p>Categories: {paper.categories.join(', ')}</p>
              )}
              <p>Published: {paper.published}</p>
              {paper.updated !== paper.published && (
                <p>Last Updated: {paper.updated}</p>
              )}
              <p>
                <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>{' '}
                |{' '}
                <a href={paper.htmlUrl} target="_blank" rel="noopener noreferrer">
                  Abstract
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Component for displaying a single arXiv paper
 */
export const ArxivPaperComponent: React.FC<{
  paper: ArxivPaper;
}> = ({ paper }) => {
  return (
    <div className="arxiv-paper">
      <h3>{paper.title}</h3>
      
      {paper.authors.length > 0 && (
        <p>
          <strong>Authors:</strong> {paper.authors.join(', ')}
        </p>
      )}
      
      <p><strong>Categories:</strong> {paper.categories.join(', ')}</p>
      <p><strong>Published:</strong> {paper.published}</p>
      
      {paper.updated !== paper.published && (
        <p><strong>Last Updated:</strong> {paper.updated}</p>
      )}
      
      {paper.doi && (
        <p><strong>DOI:</strong> {paper.doi}</p>
      )}
      
      {paper.journalRef && (
        <p><strong>Journal Reference:</strong> {paper.journalRef}</p>
      )}
      
      {paper.comment && (
        <p><strong>Comment:</strong> {paper.comment}</p>
      )}
      
      <div>
        <h4>Abstract</h4>
        <p>{paper.summary}</p>
      </div>
      
      <p>
        <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
          Download PDF
        </a>{' '}
        |{' '}
        <a href={paper.htmlUrl} target="_blank" rel="noopener noreferrer">
          View on arXiv
        </a>
      </p>
      
      {paper.doi && (
        <p>
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
            DOI: {paper.doi}
          </a>
        </p>
      )}
    </div>
  );
}; 