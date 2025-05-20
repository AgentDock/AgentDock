/**
 * @fileoverview React components for displaying OpenAlex results
 */

import React from 'react';

/**
 * OpenAlex Work (paper) interface
 */
export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  abstract?: string;
  authors: string[];
  venue?: string;
  year?: number;
  cited_by_count?: number;
  is_open_access?: boolean;
  open_access_url?: string;
  url: string;
  publication_date?: string;
  type?: string;
  concepts?: {
    id: string;
    display_name: string;
    score: number;
  }[];
  keywords?: string[];
}

/**
 * OpenAlex search result interface
 */
export interface OpenAlexSearchResult {
  query: string;
  total: number;
  works: OpenAlexWork[];
  filters: {
    open_access?: boolean;
    recent?: boolean;
    highly_cited?: boolean;
  };
}

/**
 * Component for displaying OpenAlex search results
 */
export const OpenAlexSearchResultComponent: React.FC<{
  result: OpenAlexSearchResult;
}> = ({ result }) => {
  return (
    <div className="openalex-search-result">
      <h3>OpenAlex Search Results for &quot;{result.query}&quot;</h3>
      <p>Found {result.total} results</p>
      <ul>
        {result.works.map((work, index) => (
          <li key={work.id || index}>
            <div>
              <strong>{work.title}</strong>
              {work.authors.length > 0 && (
                <p>
                  <em>{work.authors.join(', ')}</em>
                </p>
              )}
              {work.venue && <p>Published in: {work.venue}</p>}
              {work.year && <p>Year: {work.year}</p>}
              {work.cited_by_count !== undefined && <p>Citations: {work.cited_by_count}</p>}
              {work.is_open_access && (
                <p>
                  <a
                    href={work.open_access_url || work.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Access
                  </a>
                </p>
              )}
              <p>
                <a href={work.url} target="_blank" rel="noopener noreferrer">
                  View on OpenAlex
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
 * Component for displaying a single OpenAlex work (paper)
 */
export const OpenAlexWorkComponent: React.FC<{
  work: OpenAlexWork;
}> = ({ work }) => {
  return (
    <div className="openalex-work">
      <h3>{work.title}</h3>
      {work.authors.length > 0 && (
        <p>
          <strong>Authors:</strong> {work.authors.join(', ')}
        </p>
      )}
      {work.venue && (
        <p>
          <strong>Published in:</strong> {work.venue}
        </p>
      )}
      {work.publication_date && (
        <p>
          <strong>Publication Date:</strong> {work.publication_date}
        </p>
      )}
      {work.type && (
        <p>
          <strong>Type:</strong> {work.type}
        </p>
      )}
      {work.cited_by_count !== undefined && (
        <p>
          <strong>Citations:</strong> {work.cited_by_count}
        </p>
      )}
      {work.abstract && (
        <div>
          <h4>Abstract</h4>
          <p>{work.abstract}</p>
        </div>
      )}
      {work.concepts && work.concepts.length > 0 && (
        <div>
          <h4>Concepts</h4>
          <ul>
            {work.concepts.map((concept, index) => (
              <li key={concept.id || index}>
                {concept.display_name} (Score: {concept.score})
              </li>
            ))}
          </ul>
        </div>
      )}
      {work.keywords && work.keywords.length > 0 && (
        <div>
          <h4>Keywords</h4>
          <p>{work.keywords.join(', ')}</p>
        </div>
      )}
      {work.is_open_access && work.open_access_url && (
        <p>
          <a href={work.open_access_url} target="_blank" rel="noopener noreferrer">
            Access Full Text
          </a>
        </p>
      )}
      <p>
        <a href={work.url} target="_blank" rel="noopener noreferrer">
          View on OpenAlex
        </a>
      </p>
      {work.doi && (
        <p>
          <a href={`https://doi.org/${work.doi}`} target="_blank" rel="noopener noreferrer">
            DOI: {work.doi}
          </a>
        </p>
      )}
    </div>
  );
};
