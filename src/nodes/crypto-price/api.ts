/**
 * @fileoverview CoinGecko API client for cryptocurrency price data
 * This file contains functions to interact with the CoinGecko API
 */

/**
 * CoinGecko API base URL
 */
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Error response interface for CoinGecko API
 */
interface ErrorResponse {
  status?: {
    error_code?: number;
    error_message?: string;
  };
  error?: string;
}

/**
 * Check if response is an error
 */
function isErrorResponse(data: any): data is ErrorResponse {
  return (
    data &&
    (data.status?.error_code !== undefined ||
      data.status?.error_message !== undefined ||
      data.error !== undefined)
  );
}

/**
 * Cryptocurrency data interface
 */
export interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
  currency: string;
}

/**
 * Format cryptocurrency ID for CoinGecko API
 * @param id Cryptocurrency ID or symbol
 * @returns Formatted ID
 */
export function formatCryptoId(id: string): string {
  // Convert to lowercase and trim
  return id.toLowerCase().trim();
}

/**
 * Validate cryptocurrency ID format
 * @param id Cryptocurrency ID or symbol
 * @returns True if valid format
 */
export function isValidIdFormat(id: string): boolean {
  // Basic validation - non-empty string
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Fetch cryptocurrency price data from CoinGecko API
 * @param id Cryptocurrency ID to look up
 * @param currency Currency to display price in (default: usd)
 * @param apiKey CoinGecko API key (optional, uses environment variable if not provided)
 * @returns Processed cryptocurrency data
 */
export async function fetchCryptoPrice(
  id: string,
  currency: string = 'usd',
  apiKey?: string
): Promise<CryptoData> {
  // Format the ID
  const formattedId = formatCryptoId(id);

  // Use provided API key or fall back to environment variable
  const key = apiKey || process.env.COINGECKO_API_KEY || '';

  // Build API URL - for free tier we don't need to include the API key
  let url = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=${currency}&ids=${formattedId}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h`;

  // If API key is provided, use it (for Pro tier)
  if (key) {
    // For Pro tier, the base URL and authentication method would be different
    // This is a placeholder for when you upgrade to Pro
    // url = `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${formattedId}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h`;
    // headers = { 'x-cg-pro-api-key': key };
  }

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      if (data.status?.error_message) {
        throw new Error(`API error: ${data.status.error_message}`);
      }
      if (data.error) {
        throw new Error(`API error: ${data.error}`);
      }
    }

    // Check if data is an array and has at least one item
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No data found for cryptocurrency: ${formattedId}`);
    }

    // Extract the first item (should be the only one since we used per_page=1)
    const cryptoData = data[0];

    // Process and return cryptocurrency data
    return {
      id: cryptoData.id,
      symbol: cryptoData.symbol,
      name: cryptoData.name,
      price: cryptoData.current_price,
      price_change_24h: cryptoData.price_change_24h,
      price_change_percentage_24h: cryptoData.price_change_percentage_24h,
      market_cap: cryptoData.market_cap,
      total_volume: cryptoData.total_volume,
      high_24h: cryptoData.high_24h,
      low_24h: cryptoData.low_24h,
      last_updated: cryptoData.last_updated,
      currency: currency
    };
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(`Failed to fetch cryptocurrency price: ${error.message}`);
    }
    throw new Error('Failed to fetch cryptocurrency price: Unknown error');
  }
}

/**
 * Search for cryptocurrencies matching a keyword
 * @param query Keywords to search for
 * @param apiKey CoinGecko API key (optional, uses environment variable if not provided)
 * @returns Array of matching cryptocurrencies and their metadata
 */
export async function searchCryptos(query: string, apiKey?: string) {
  // Use provided API key or fall back to environment variable
  const _key = apiKey || process.env.COINGECKO_API_KEY || '';

  // Build API URL
  const url = `${COINGECKO_API_BASE_URL}/search?query=${encodeURIComponent(query)}`;

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      if (data.status?.error_message) {
        throw new Error(`API error: ${data.status.error_message}`);
      }
      if (data.error) {
        throw new Error(`API error: ${data.error}`);
      }
    }

    // Check if data contains coins
    if (!data.coins || !Array.isArray(data.coins)) {
      return [];
    }

    // Return the matches
    return data.coins;
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(`Failed to search cryptocurrencies: ${error.message}`);
    }
    throw new Error('Failed to search cryptocurrencies: Unknown error');
  }
}

/**
 * Get trending cryptocurrencies
 * @param apiKey CoinGecko API key (optional, uses environment variable if not provided)
 * @returns Array of trending cryptocurrencies
 */
export async function getTrendingCryptos(apiKey?: string) {
  // Use provided API key or fall back to environment variable
  const _key = apiKey || process.env.COINGECKO_API_KEY || '';

  // Build API URL
  const url = `${COINGECKO_API_BASE_URL}/search/trending`;

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      if (data.status?.error_message) {
        throw new Error(`API error: ${data.status.error_message}`);
      }
      if (data.error) {
        throw new Error(`API error: ${data.error}`);
      }
    }

    // Check if data contains coins
    if (!data.coins || !Array.isArray(data.coins)) {
      return [];
    }

    // Return the trending coins
    return data.coins;
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(
        `Failed to get trending cryptocurrencies: ${error.message}`
      );
    }
    throw new Error('Failed to get trending cryptocurrencies: Unknown error');
  }
}
