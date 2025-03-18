# Stock Price Tool

This tool provides real-time stock price data using the AlphaVantage API. It allows AI agents to fetch current stock prices and related market data for any publicly traded company.

## Features

- Fetch real-time stock price data
- Get detailed market information (open, high, low, volume, etc.)
- Format data in a readable, consistent way
- Handle errors gracefully
- Support for custom API keys

## Usage

The stock price tool can be used by AI agents to get current stock price information. Here's how to use it:

```typescript
// Example usage in an agent
const result = await stockPriceTool.execute({
  symbol: 'AAPL',
  apiKey: 'your_alphavantage_api_key' // Optional
});
```

## Parameters

| Parameter | Type   | Required | Description                                                |
|-----------|--------|----------|------------------------------------------------------------|
| symbol    | string | Yes      | Stock symbol to look up (e.g., AAPL, MSFT, GOOGL)          |
| apiKey    | string | No       | Optional AlphaVantage API key (uses env var if not provided) |

## Response

The tool returns a formatted response with the following information:

- Current stock price
- Price change (amount and percentage)
- Trading day
- Today's price range (high/low)
- Opening price
- Previous closing price
- Trading volume

## API Key

By default, the tool uses the `ALPHAVANTAGE_API_KEY` environment variable. You can also pass an API key directly to the tool.

To get an API key, visit [AlphaVantage](https://www.alphavantage.co/support/#api-key).

## Implementation Details

The tool uses the AlphaVantage GLOBAL_QUOTE endpoint to fetch current stock price data. It formats the response using the StockPrice component for consistent presentation.

## Error Handling

The tool handles various error scenarios:

- Invalid stock symbols
- API rate limiting
- Network errors
- Missing data

## Example Output

```
📈 **AAPL** Stock Price

**Current Price:** $173.45 ▲ $2.31 (+1.35%)
**Trading Day:** Mar 15, 2024

**Today's Range:** $170.12 - $174.89
**Open:** $171.22
**Previous Close:** $171.14
**Volume:** 67,532,145

_Data provided by Alpha Vantage_
```

## Dependencies

- AlphaVantage API
- Zod for parameter validation
- AgentDock Core for logging 