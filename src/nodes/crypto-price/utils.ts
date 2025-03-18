/**
 * @fileoverview Utility functions for cryptocurrency price data
 */

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
 * Format currency value with symbol
 * @param amount Number to format
 * @param currency Currency code (e.g., 'usd', 'eur')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  // Get currency symbol
  const currencySymbol = getCurrencySymbol(currency);
  
  // Format with appropriate decimal places
  return `${currencySymbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })}`;
}

/**
 * Get currency symbol from currency code
 * @param currency Currency code (e.g., 'usd', 'eur')
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: string = 'usd'): string {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    jpy: '¥',
    cny: '¥',
    krw: '₩',
    inr: '₹',
    rub: '₽',
    btc: '₿',
    eth: 'Ξ',
  };
  
  return symbols[currency.toLowerCase()] || currency.toUpperCase() + ' ';
}

/**
 * Format percentage change
 * @param percent Percentage value
 * @returns Formatted percentage string with sign
 */
export function formatPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Format large numbers (like market cap, volume)
 * @param num Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  } else {
    return num.toLocaleString('en-US');
  }
}

/**
 * Format timestamp to readable date
 * @param timestamp ISO timestamp string
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get emoji for price change
 * @param change Price change value
 * @returns Appropriate emoji
 */
export function getPriceChangeEmoji(change: number): string {
  if (change > 3) return '🚀'; // Rocket for big gains
  if (change > 0) return '📈'; // Chart up for gains
  if (change < -3) return '📉'; // Chart down for big losses
  if (change < 0) return '📉'; // Chart down for losses
  return '➡️'; // Right arrow for no change
}

/**
 * Get symbol for price change direction
 * @param change Price change value
 * @returns Direction symbol
 */
export function getPriceChangeSymbol(change: number): string {
  if (change > 0) return '▲';
  if (change < 0) return '▼';
  return '▶';
} 