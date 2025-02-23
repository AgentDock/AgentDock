/**
 * @fileoverview Stock price tool implementation following Vercel AI SDK patterns.
 * Provides a dummy stock price lookup functionality for testing purposes.
 */

import { z } from 'zod';
import { Tool } from '../types';

/**
 * Stock price tool result interface
 */
export interface StockPriceResult {
  price: number;
  currency: string;
  symbol: string;
  timestamp: string;
}

/**
 * Schema for stock price tool parameters
 */
const stockPriceSchema = z.object({
  symbol: z.string().describe('Stock symbol to look up price for'),
  currency: z.string().default('USD').describe('Currency to return price in')
});

/**
 * Type inference from schema
 */
type StockPriceParams = z.infer<typeof stockPriceSchema>;

/**
 * Stock price tool implementation - dead simple mock
 */
export const stockPriceTool: Tool = {
  name: 'stock_price',
  description: 'Get the current stock price for a given symbol',
  parameters: stockPriceSchema,
  async execute({ symbol, currency = 'USD' }) {
    // Just return mock data immediately
    return {
      symbol: symbol.toUpperCase(),
      price: 150.42,
      currency,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  'stock_price': stockPriceTool
}; 