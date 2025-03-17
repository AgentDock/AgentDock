/**
 * @fileoverview Cryptocurrency price tool implementation using CoinGecko API.
 * Provides real-time cryptocurrency price data.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../types';
import { CryptoPrice, CryptoPriceError, TrendingCryptos } from './components';
import { fetchCryptoPrice, getTrendingCryptos } from './api';
import { formatCryptoId, isValidIdFormat } from './utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Cryptocurrency price tool result interface
 */
export interface CryptoPriceResult {
  id: string;
  name: string;
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
}

/**
 * Schema for cryptocurrency price tool parameters
 */
const cryptoPriceSchema = z.object({
  id: z.string().describe('Cryptocurrency ID or symbol to look up price for (e.g., bitcoin, ethereum, BTC, ETH)'),
  currency: z.string().optional().describe('Currency to display price in (e.g., usd, eur, btc)'),
  apiKey: z.string().optional().describe('Optional CoinGecko API key (will use environment variable if not provided)')
});

/**
 * Type inference from schema
 */
type CryptoPriceParams = z.infer<typeof cryptoPriceSchema>;

/**
 * Cryptocurrency price tool implementation using CoinGecko API
 */
export const cryptoPriceTool: Tool = {
  name: 'crypto_price',
  description: 'Get the current cryptocurrency price and market data for a given coin ID or symbol',
  parameters: cryptoPriceSchema,
  async execute({ id, currency = 'usd', apiKey }: CryptoPriceParams, options: ToolExecutionOptions) {
    try {
      // Format and validate the ID
      const formattedId = formatCryptoId(id);
      
      // Basic validation
      if (!formattedId) {
        throw new Error('Cryptocurrency ID is required');
      }
      
      if (!isValidIdFormat(formattedId)) {
        throw new Error('Invalid cryptocurrency ID format');
      }
      
      logger.debug(LogCategory.NODE, '[CryptoPrice]', `Fetching cryptocurrency price for ${formattedId}`);
      
      // Fetch cryptocurrency data from CoinGecko API
      const cryptoData = await fetchCryptoPrice(formattedId, currency, apiKey);
      
      // Log successful fetch
      logger.debug(LogCategory.NODE, '[CryptoPrice]', `Successfully fetched cryptocurrency price for ${formattedId}`, {
        price: cryptoData.price,
        change: cryptoData.price_change_24h,
        changePercent: cryptoData.price_change_percentage_24h
      });
      
      // Use our CryptoPrice component to format the output
      return CryptoPrice(cryptoData);
    } catch (error) {
      // Log error
      logger.error(LogCategory.NODE, '[CryptoPrice]', `Error fetching cryptocurrency price for ${id}`, { error });
      
      // Return error message
      return CryptoPriceError(error instanceof Error ? error.message : 'Unknown error', id);
    }
  }
};

/**
 * Schema for trending cryptocurrencies tool parameters
 */
const trendingCryptosSchema = z.object({
  apiKey: z.string().optional().describe('Optional CoinGecko API key (will use environment variable if not provided)')
});

/**
 * Type inference from schema
 */
type TrendingCryptosParams = z.infer<typeof trendingCryptosSchema>;

/**
 * Trending cryptocurrencies tool implementation using CoinGecko API
 */
export const trendingCryptosTool: Tool = {
  name: 'trending_cryptos',
  description: 'Get a list of trending cryptocurrencies',
  parameters: trendingCryptosSchema,
  async execute({ apiKey }: TrendingCryptosParams, options: ToolExecutionOptions) {
    try {
      logger.debug(LogCategory.NODE, '[TrendingCryptos]', 'Fetching trending cryptocurrencies');
      
      // Fetch trending cryptocurrencies from CoinGecko API
      const trendingCoins = await getTrendingCryptos(apiKey);
      
      // Log successful fetch
      logger.debug(LogCategory.NODE, '[TrendingCryptos]', `Successfully fetched ${trendingCoins.length} trending cryptocurrencies`);
      
      // Use our TrendingCryptos component to format the output
      return TrendingCryptos(trendingCoins);
    } catch (error) {
      // Log error
      logger.error(LogCategory.NODE, '[TrendingCryptos]', 'Error fetching trending cryptocurrencies', { error });
      
      // Return error message
      return {
        type: 'crypto_trending_error',
        content: `Error: Unable to fetch trending cryptocurrencies. ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * Export tools in the format expected by the registry
 */
export const tools = {
  crypto_price: cryptoPriceTool,
  trending_cryptos: trendingCryptosTool
}; 