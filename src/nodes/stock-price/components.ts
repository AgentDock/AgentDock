/**
 * @fileoverview Stock price UI components for rendering stock data.
 * These components are used by the stock price tool to display information.
 */

/**
 * Helper function to format currency
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Helper function to format timestamp
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Stock price component props
 */
interface StockPriceProps {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
}

/**
 * Stock price React component
 */
export function StockPrice(props: StockPriceProps) {
  const formattedPrice = formatCurrency(props.price, props.currency);
  const formattedTime = formatTimestamp(props.timestamp);
  
  return {
    type: 'stock_price',
    content: `📈 **${props.symbol}** Stock Price
Price: ${formattedPrice}
Last Updated: ${formattedTime}`
  };
} 