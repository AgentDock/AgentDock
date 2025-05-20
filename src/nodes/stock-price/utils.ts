/**
 * @fileoverview Utility functions for stock price operations
 */

/**
 * Calculate the moving average for a series of prices
 * @param prices Array of prices
 * @param period Number of periods for the moving average
 * @returns Moving average value
 */
export function calculateMovingAverage(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Not enough data points for ${period}-period moving average`);
  }

  const sum = prices.slice(0, period).reduce((acc, price) => acc + price, 0);
  return sum / period;
}

/**
 * Calculate the Relative Strength Index (RSI)
 * @param prices Array of prices (oldest to newest)
 * @param period Number of periods for RSI calculation (typically 14)
 * @returns RSI value (0-100)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) {
    throw new Error(`Not enough data points for ${period}-period RSI`);
  }

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Calculate average gains and losses
  let avgGain = 0;
  let avgLoss = 0;

  // First period
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate RS and RSI
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

/**
 * Determine if a stock is likely volatile based on price history
 * @param prices Array of prices
 * @returns Boolean indicating if stock is volatile
 */
export function isVolatile(prices: number[]): boolean {
  if (prices.length < 2) {
    return false;
  }

  // Calculate standard deviation
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const squaredDiffs = prices.map((price) => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // Calculate coefficient of variation (CV)
  const cv = stdDev / mean;

  // A CV > 0.1 (10%) is considered volatile
  return cv > 0.1;
}

/**
 * Format a stock symbol to ensure it's in the correct format
 * @param symbol Raw stock symbol input
 * @returns Formatted stock symbol
 */
export function formatStockSymbol(symbol: string): string {
  // Remove any whitespace and convert to uppercase
  return symbol.trim().toUpperCase();
}

/**
 * Check if a given string is a valid stock symbol format
 * @param symbol Stock symbol to validate
 * @returns Boolean indicating if symbol format is valid
 */
export function isValidSymbolFormat(symbol: string): boolean {
  // Basic validation: 1-5 uppercase letters
  return /^[A-Z]{1,5}$/.test(symbol);
}
