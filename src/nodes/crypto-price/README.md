# Cryptocurrency Price Tool

This tool provides real-time cryptocurrency price data using the CoinGecko API. It allows AI agents to fetch current cryptocurrency prices and related market data for any cryptocurrency.

## Features

- Fetch real-time cryptocurrency price data
- Get detailed market information (market cap, volume, 24h high/low, etc.)
- View trending cryptocurrencies
- Format data in a readable, consistent way
- Handle errors gracefully
- Support for custom API keys

## Usage

The cryptocurrency price tool can be used by AI agents to get current cryptocurrency price information. Here's how to use it:

```typescript
// Example usage in an agent for specific cryptocurrency
const result = await cryptoPriceTool.execute({
  id: 'bitcoin',
  currency: 'usd',
  apiKey: 'your_coingecko_api_key' // Optional
});

// Example usage for trending cryptocurrencies
const trending = await trendingCryptosTool.execute({
  apiKey: 'your_coingecko_api_key' // Optional
});
```

## Parameters

### Crypto Price Tool

| Parameter | Type   | Required | Description                                                |
|-----------|--------|----------|------------------------------------------------------------|
| id        | string | Yes      | Cryptocurrency ID or symbol (e.g., bitcoin, ethereum, BTC) |
| currency  | string | No       | Currency to display price in (e.g., usd, eur, btc)         |
| apiKey    | string | No       | Optional CoinGecko API key (uses env var if not provided)  |

### Trending Cryptos Tool

| Parameter | Type   | Required | Description                                                |
|-----------|--------|----------|------------------------------------------------------------|
| apiKey    | string | No       | Optional CoinGecko API key (uses env var if not provided)  |

## Response

### Crypto Price Tool

The tool returns a formatted response with the following information:

- Current cryptocurrency price
- Price change (amount and percentage)
- Last updated timestamp
- 24h price range (high/low)
- Market capitalization
- 24h trading volume

### Trending Cryptos Tool

The tool returns a formatted list of trending cryptocurrencies with:

- Cryptocurrency name and symbol
- Market cap rank (if available)

## API Key

By default, the tool uses the `COINGECKO_API_KEY` environment variable. You can also pass an API key directly to the tool.

For the free tier, an API key is not required, but there are rate limits (approximately 30 calls per minute, with a maximum of 10-50 calls per minute depending on server load).

To get an API key for higher rate limits, visit [CoinGecko](https://www.coingecko.com/en/api/pricing).

## Implementation Details

The tool uses the CoinGecko public API to fetch cryptocurrency price data. It formats the response using the CryptoPrice component for consistent presentation.

For the free tier, the following endpoints are used:
- `/coins/markets` - For cryptocurrency price and market data
- `/search/trending` - For trending cryptocurrencies

## Rate Limits

The free tier of CoinGecko API has the following limitations:
- Approximately 30 calls per minute (varies based on server load)
- No API key required

## Error Handling

The tool handles various error scenarios:

- Invalid cryptocurrency IDs
- API rate limiting
- Network errors
- Missing data

## Example Output

### Crypto Price Tool

```
🚀 **Bitcoin** (BTC)

**Current Price:** $65,432.78 ▲ $1,234.56 (+1.92%)
**Last Updated:** Mar 15, 2024, 10:30 AM

**24h Range:** $64,321.45 - $65,987.65
**Market Cap:** $1.23T
**24h Volume:** $45.67B

_Data provided by CoinGecko_
```

### Trending Cryptos Tool

```
## 🔥 Trending Cryptocurrencies

1. **Bitcoin** (BTC) - Rank #1
2. **Ethereum** (ETH) - Rank #2
3. **Solana** (SOL) - Rank #5
4. **Dogecoin** (DOGE) - Rank #10
5. **Cardano** (ADA) - Rank #8
6. **Polkadot** (DOT) - Rank #12
7. **Chainlink** (LINK) - Rank #15

_Data provided by CoinGecko_
```

## Dependencies

- CoinGecko API
- Zod for parameter validation
- AgentDock Core for logging 