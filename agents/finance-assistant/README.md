# Finance Assistant

Specialized finance assistant with access to real-time stock and cryptocurrency data.

## Description

A finance-focused agent designed to provide up-to-date information about stocks and cryptocurrencies, helping users stay informed about market trends and make data-driven decisions.

## Features

- Real-time stock price data via AlphaVantage API
- Cryptocurrency price information via CoinGecko API
- Trending cryptocurrencies tracking
- Market data visualization through formatted responses
- Financial information in an easy-to-understand format

## Nodes

The agent uses the following nodes:
- llm.anthropic: Advanced language model for financial analysis and communication
- stock_price: Real-time stock market data from AlphaVantage
- crypto_price: Current cryptocurrency prices from CoinGecko
- trending_cryptos: List of trending cryptocurrencies

## Configuration

See `template.json` for the full configuration.

## Conversation Capabilities

1. Stock Market Information
   - Current stock prices
   - Price changes and percentages
   - Trading volume and market data
   - Historical comparisons

2. Cryptocurrency Data
   - Real-time crypto prices
   - Market capitalization
   - 24-hour trading ranges
   - Trending cryptocurrencies

3. Financial Context
   - Market trend explanations
   - Basic investment information
   - Disclaimers about financial advice
   - Data-driven insights

## Usage Example

```typescript
const agent = new AgentNode('chat', config);
await agent.initialize();

const response = await agent.execute('What is the current price of Bitcoin?');
console.log(response);
```

## Best Practices

1. Financial Queries
   - Use specific stock symbols or cryptocurrency names
   - Ask for current prices or trends
   - Request comparisons between assets
   - Inquire about market context

2. Data Interpretation
   - Ask for explanations of market movements
   - Request historical context when relevant
   - Seek clarification on financial terminology
   - Ask about data sources and reliability

3. Settings Customization
   - Adjust temperature for more factual responses
   - Configure API keys for higher rate limits
   - Customize initial greeting for your financial use case

## Important Notes

- Financial data is provided for informational purposes only
- Not intended as investment advice
- Data accuracy depends on third-party API providers
- Free tier API limitations may apply 