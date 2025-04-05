"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { debounce } from 'lodash-es';
import { CommandDialog } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';

type SearchResult = {
  id: string;
  title: string;
  content: string;
  url: string;
  score?: number; // For relevance scoring
};

// Define our search index state
const DOC_INDEX: SearchResult[] = [];

// Maximum number of results to display
const MAX_RESULTS = 5;

// Function to build the search index
async function buildSearchIndex() {
  try {
    // Fetch the static search index file
    const response = await fetch('/search-index.json');
    if (!response.ok) {
      console.error('Failed to fetch search index:', response.statusText);
      return;
    }
    
    const data = await response.json();
    
    // Clear the array and add new items
    DOC_INDEX.length = 0;
    DOC_INDEX.push(...data);
    
    console.log(`Loaded search index with ${DOC_INDEX.length} entries`);
  } catch (error) {
    console.error('Error loading search index:', error);
  }
}

// Helper to highlight matched text
function highlightMatches(text: string, searchTerms: string[]): React.ReactNode {
  if (!searchTerms.length) return <>{text}</>;
  
  // Create a regex that matches any of the search terms (case insensitive)
  const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => {
        // Check if this part matches any search term
        const isMatch = searchTerms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        );
        
        return isMatch ? 
          <span key={i} className="bg-yellow-100 dark:bg-yellow-900/40">{part}</span> : 
          <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function DocSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  
  // Initialize the search index
  useEffect(() => {
    if (!indexReady && DOC_INDEX.length === 0) {
      setIsSearching(true);
      buildSearchIndex().finally(() => {
        setIndexReady(true);
        setIsSearching(false);
      });
    }
  }, [indexReady]);
  
  // Enhanced search implementation with relevance scoring
  const performSearch = useCallback(
    debounce((searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      const searchTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);
      
      // Score and filter results
      const scoredResults = DOC_INDEX
        .map(item => {
          const titleLower = item.title.toLowerCase();
          const contentLower = item.content.toLowerCase();
          let score = 0;
          
          // Calculate relevance score
          searchTerms.forEach(term => {
            // Exact title match gets highest score
            if (titleLower === term) score += 100;
            
            // Title contains term gets high score
            else if (titleLower.includes(term)) score += 50;
            
            // Exact phrase match in content
            if (contentLower.includes(term)) score += 10;
            
            // Bonus for longer term matches (likely more specific)
            score += term.length / 10;
          });
          
          // Only include results that match at least one term
          const hasMatch = score > 0;
          
          return {
            ...item,
            score: hasMatch ? score : 0
          };
        })
        .filter(item => item.score! > 0)
        .sort((a, b) => b.score! - a.score!)
        .slice(0, MAX_RESULTS);

      setResults(scoredResults);
      setIsSearching(false);
    }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      setIsSearching(true);
      performSearch(query);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [query, performSearch]);

  // Handle keyboard shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (url: string) => {
    setOpen(false);
    window.location.href = url;
  };

  // Extract search terms for highlighting
  const searchTerms = query.toLowerCase().split(' ').filter(Boolean);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-accent/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search docs...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className="flex h-11 w-full rounded-md border-0 bg-transparent py-3 text-sm shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-transparent"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        
        {isSearching && (
          <div className="py-6 text-center text-sm">Searching...</div>
        )}
        
        {!isSearching && results.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
              Documentation ({results.length} results)
            </div>
            <ScrollArea className="max-h-[60vh]">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="cursor-pointer px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={() => handleSelect(result.url)}
                >
                  <div className="font-medium mb-0.5">
                    {highlightMatches(result.title, searchTerms)}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {highlightMatches(result.content, searchTerms)}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
        
        {!isSearching && query.length > 0 && results.length === 0 && (
          <div className="py-6 text-center text-sm">No results found.</div>
        )}
        
        {!indexReady && !isSearching && DOC_INDEX.length === 0 && (
          <div className="py-6 text-center text-sm">Loading search index...</div>
        )}
      </CommandDialog>
    </>
  );
} 