/**
 * @fileoverview Stock price UI components for rendering stock data.
 * These components are used by the stock price tool to display information.
 */

import { StockData } from './api';

/**
 * Helper function to format currency
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Helper function to format large numbers (like volume)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Helper function to format percentage
 */
export function formatPercent(percent: number): string {
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

/**
 * Helper function to format timestamp
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Stock price component props
 * Extends StockData with additional UI-specific properties if needed
 */
export type StockPriceProps = StockData;

/**
 * Stock price React component
 */
export function StockPrice(props: StockPriceProps) {
  const formattedPrice = formatCurrency(props.price, props.currency);
  const formattedOpen = formatCurrency(props.open, props.currency);
  const formattedHigh = formatCurrency(props.high, props.currency);
  const formattedLow = formatCurrency(props.low, props.currency);
  const formattedPrevClose = formatCurrency(props.previousClose, props.currency);
  const formattedChange = formatCurrency(props.change, props.currency);
  const formattedChangePercent = formatPercent(props.changePercent);
  const formattedVolume = formatNumber(props.volume);
  const formattedDate = formatTimestamp(props.latestTradingDay);

  // Determine if price is up or down
  const priceDirection = props.change >= 0 ? '📈' : '📉';
  const changeSymbol = props.change >= 0 ? '▲' : '▼';

  return {
    type: 'stock_price',
    content: `${priceDirection} **${props.symbol}** Stock Price

**Current Price:** ${formattedPrice} ${changeSymbol} ${formattedChange} (${formattedChangePercent})
**Trading Day:** ${formattedDate}

**Today's Range:** ${formattedLow} - ${formattedHigh}
**Open:** ${formattedOpen}
**Previous Close:** ${formattedPrevClose}
**Volume:** ${formattedVolume}

_Data provided by Alpha Vantage_`,
  };
}
