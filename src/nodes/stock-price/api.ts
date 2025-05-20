/**
 * @fileoverview AlphaVantage API client for stock price data
 * This file contains functions to interact with the AlphaVantage API
 */

import { formatStockSymbol } from './utils';

/**
 * Global Quote response interface from AlphaVantage API
 */
export interface GlobalQuoteResponse {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}

/**
 * Processed stock data interface
 */
export interface StockData {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
}

/**
 * Error response from AlphaVantage API
 */
export interface AlphaVantageErrorResponse {
  Note?: string;
  Information?: string;
  Error?: string;
}

/**
 * Check if response is an error response
 * @param data Response data from AlphaVantage API
 * @returns Boolean indicating if response is an error
 */
function isErrorResponse(data: any): data is AlphaVantageErrorResponse {
  return (
    data &&
    (typeof data.Note === 'string' ||
      typeof data.Information === 'string' ||
      typeof data.Error === 'string')
  );
}

/**
 * Sanitize error messages to remove sensitive information like API keys
 * @param message Error message that might contain sensitive information
 * @returns Sanitized error message
 */
function sanitizeErrorMessage(message: string): string {
  // Remove API keys (alphanumeric strings of 16+ characters)
  return message.replace(/[A-Z0-9]{16,}/g, '[API_KEY_REDACTED]');
}

/**
 * Fetch stock price data from AlphaVantage API
 * @param symbol Stock symbol to look up
 * @param apiKey AlphaVantage API key (optional, uses environment variable if not provided)
 * @returns Processed stock data
 */
export async function fetchStockPrice(symbol: string, apiKey?: string): Promise<StockData> {
  // Format the symbol
  const formattedSymbol = formatStockSymbol(symbol);

  // Use provided API key or fall back to environment variable
  const key = apiKey || process.env.ALPHAVANTAGE_API_KEY || 'demo';

  // Build API URL
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(formattedSymbol)}&apikey=${key}`;

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(`AlphaVantage API error: ${response.status} ${response.statusText}`);
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      if (data.Note) {
        throw new Error(`API limit reached: ${sanitizeErrorMessage(data.Note)}`);
      }
      if (data.Information) {
        throw new Error(`API information: ${sanitizeErrorMessage(data.Information)}`);
      }
      if (data.Error) {
        throw new Error(`API error: ${sanitizeErrorMessage(data.Error)}`);
      }
    }

    // Check if data contains Global Quote
    if (!data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
      throw new Error(`No data found for symbol: ${formattedSymbol}`);
    }

    // Extract quote data
    const quote = data['Global Quote'];

    // Process and return stock data
    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      open: parseFloat(quote['02. open']),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume'], 10),
      latestTradingDay: quote['07. latest trading day'],
      previousClose: parseFloat(quote['08. previous close']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      currency: 'USD', // AlphaVantage doesn't provide currency in GLOBAL_QUOTE, default to USD
    };
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(`Failed to fetch stock price: ${sanitizeErrorMessage(error.message)}`);
    }
    throw new Error('Failed to fetch stock price: Unknown error');
  }
}

/**
 * Determine if a market is open based on the latest trading day
 * @param latestTradingDay Latest trading day from API
 * @returns Boolean indicating if market is currently open
 */
export function isMarketOpen(latestTradingDay: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return latestTradingDay === today;
}

/**
 * Search for stock symbols matching a keyword
 * @param keywords Keywords to search for
 * @param apiKey AlphaVantage API key (optional, uses environment variable if not provided)
 * @returns Array of matching symbols and their metadata
 */
export async function searchSymbols(keywords: string, apiKey?: string) {
  // Use provided API key or fall back to environment variable
  const key = apiKey || process.env.ALPHAVANTAGE_API_KEY || 'demo';

  // Build API URL
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${key}`;

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(`AlphaVantage API error: ${response.status} ${response.statusText}`);
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      if (data.Note) {
        throw new Error(`API limit reached: ${sanitizeErrorMessage(data.Note)}`);
      }
      if (data.Information) {
        throw new Error(`API information: ${sanitizeErrorMessage(data.Information)}`);
      }
      if (data.Error) {
        throw new Error(`API error: ${sanitizeErrorMessage(data.Error)}`);
      }
    }

    // Check if data contains bestMatches
    if (!data.bestMatches || !Array.isArray(data.bestMatches)) {
      return [];
    }

    // Return the matches
    return data.bestMatches;
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(`Failed to search symbols: ${sanitizeErrorMessage(error.message)}`);
    }
    throw new Error('Failed to search symbols: Unknown error');
  }
}
