/**
 * @fileoverview Cryptocurrency price UI components for rendering crypto data.
 * These components are used by the crypto price tool to display information.
 */

import { CryptoData } from './api';
import {
  formatCurrency,
  formatPercent,
  formatTimestamp,
  getPriceChangeEmoji,
  getPriceChangeSymbol
} from './utils';

/**
 * Cryptocurrency price component props
 * Extends CryptoData with additional UI-specific properties if needed
 */
export type CryptoPriceProps = CryptoData;

/**
 * Cryptocurrency price React component
 */
export function CryptoPrice(props: CryptoPriceProps) {
  const formattedPrice = formatCurrency(props.price, props.currency);
  const formattedMarketCap = formatCurrency(props.market_cap, props.currency);
  const formattedVolume = formatCurrency(props.total_volume, props.currency);
  const formattedHigh = formatCurrency(props.high_24h, props.currency);
  const formattedLow = formatCurrency(props.low_24h, props.currency);
  const formattedChange = formatCurrency(
    Math.abs(props.price_change_24h),
    props.currency
  );
  const formattedChangePercent = formatPercent(
    props.price_change_percentage_24h
  );
  const formattedDate = formatTimestamp(props.last_updated);

  // Determine price change direction
  const priceDirection = getPriceChangeEmoji(props.price_change_percentage_24h);
  const changeSymbol = getPriceChangeSymbol(props.price_change_percentage_24h);

  return {
    type: 'crypto_price',
    content: `${priceDirection} **${props.name}** (${props.symbol.toUpperCase()})

**Current Price:** ${formattedPrice} ${changeSymbol} ${formattedChange} (${formattedChangePercent})
**Last Updated:** ${formattedDate}

**24h Range:** ${formattedLow} - ${formattedHigh}
**Market Cap:** ${formattedMarketCap}
**24h Volume:** ${formattedVolume}

_Data provided by CoinGecko_`
  };
}

/**
 * Trending cryptocurrencies component
 * @param coins Array of trending coins
 * @returns Formatted trending coins display
 */
export function TrendingCryptos(coins: any[]) {
  if (!coins || coins.length === 0) {
    return {
      type: 'crypto_trending_empty',
      content: 'No trending cryptocurrencies found.'
    };
  }

  // Format each trending coin
  const trendingList = coins
    .map((coin, index) => {
      const item = coin.item || coin;
      return `${index + 1}. **${item.name}** (${item.symbol}) - Rank #${item.market_cap_rank || 'N/A'}`;
    })
    .join('\n');

  return {
    type: 'crypto_trending',
    content: `## 🔥 Trending Cryptocurrencies

${trendingList}

_Data provided by CoinGecko_`
  };
}

/**
 * Error component for cryptocurrency price errors
 * @param error Error message
 * @param id Cryptocurrency ID that caused the error
 * @returns Formatted error message
 */
export function CryptoPriceError(error: string, id: string) {
  return {
    type: 'crypto_price_error',
    content: `## ❌ Error Fetching Cryptocurrency Data

**ID:** ${id}
**Error:** ${error}

Please check that you've entered a valid cryptocurrency ID or symbol.
You can search for valid IDs using the CoinGecko API.`
  };
}
