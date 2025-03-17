/**
 * @fileoverview Stock price tool implementation using AlphaVantage API.
 * Provides real-time and historical stock price data.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../types';
import { StockPrice } from './components';
import { fetchStockPrice } from './api';
import { formatStockSymbol, isValidSymbolFormat } from './utils';
import { logger, LogCategory } from 'agentdock-core';

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
  symbol: z.string().describe('Stock symbol to look up price for (e.g., AAPL, MSFT, GOOGL)'),
  apiKey: z.string().optional().describe('Optional AlphaVantage API key (will use environment variable if not provided)')
});

/**
 * Type inference from schema
 */
type StockPriceParams = z.infer<typeof stockPriceSchema>;

/**
 * Stock price tool implementation using AlphaVantage API
 */
export const stockPriceTool: Tool = {
  name: 'stock_price',
  description: 'Get the current stock price and market data for a given symbol',
  parameters: stockPriceSchema,
  async execute({ symbol, apiKey }: StockPriceParams, options: ToolExecutionOptions) {
    try {
      // Format and validate the symbol
      const formattedSymbol = formatStockSymbol(symbol);
      
      // Basic validation
      if (!formattedSymbol) {
        throw new Error('Stock symbol is required');
      }
      
      logger.debug(LogCategory.NODE, '[StockPrice]', `Fetching stock price for ${formattedSymbol}`);
      
      // Fetch stock data from AlphaVantage API
      const stockData = await fetchStockPrice(formattedSymbol, apiKey);
      
      // Log successful fetch
      logger.debug(LogCategory.NODE, '[StockPrice]', `Successfully fetched stock price for ${formattedSymbol}`, {
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent
      });
      
      // Use our StockPrice component to format the output
      return StockPrice(stockData);
    } catch (error) {
      // Log error
      logger.error(LogCategory.NODE, '[StockPrice]', `Error fetching stock price for ${symbol}`, { error });
      
      // Return error message
      return {
        type: 'stock_price_error',
        content: `Error: Unable to fetch stock price for ${symbol}. ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  'stock_price': stockPriceTool
}; 