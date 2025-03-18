# Snowtracer Tool

A tool for accessing Avalanche blockchain data through the Snowtrace API.

## Tool Name

When using this tool in your agent configuration, use the name: `snowtracer`

## Features

- **Address Information**: Get balance and transaction history for any Avalanche address
- **Token Tracking**: View token transfers and balances
- **Contract Data**: Access contract ABIs and source code
- **Network Stats**: Get AVAX price and gas oracle data
- **Dynamic Gas Oracle**: Get accurate, real-time gas price recommendations based on network activity
- **Comprehensive API**: Access to all Snowtrace API endpoints

## Usage

```typescript
// Get AVAX balance for an address
snowtracer({
  action: 'address_balance',
  address: '0x1234567890abcdef1234567890abcdef12345678'
})

// Get transaction history
snowtracer({
  action: 'transactions',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  limit: 5
})

// Get token transfers
snowtracer({
  action: 'token_transfers',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12' // Optional
})

// Get contract ABI
snowtracer({
  action: 'contract_abi',
  address: '0x1234567890abcdef1234567890abcdef12345678'
})

// Get AVAX price
snowtracer({
  action: 'avax_price'
})

// Get gas oracle data
snowtracer({
  action: 'gas_oracle'
})
```

## Agent Integration

To use the Snowtracer tool in your agent, add it to the `nodes` array in your agent's `template.json` file:

```json
{
  "version": "1.0",
  "agentId": "avalanche-explorer",
  "name": "Avalanche Explorer",
  "description": "Agent for exploring and analyzing Avalanche blockchain data",
  "personality": [
    "You are an expert in Avalanche blockchain technology.",
    "You can help users explore addresses, transactions, and smart contracts on the Avalanche network.",
    "You know how to use the Snowtracer tool to fetch real-time blockchain data.",
    "When users ask about Avalanche addresses or transactions, proactively use the Snowtracer tool to fetch relevant data."
  ],
  "nodes": [
    "llm.anthropic",
    "search",
    "snowtracer"
  ],
  "nodeConfigurations": {
    "llm.anthropic": {
      "model": "claude-3-7-sonnet-20250219",
      "temperature": 0.7,
      "maxTokens": 4096,
      "useCustomApiKey": false
    }
  },
  "chatSettings": {
    "historyPolicy": "lastN",
    "historyLength": 50,
    "initialMessages": [
      "Hello! I'm your Avalanche Explorer assistant. I can help you explore the Avalanche blockchain, check address balances, view transactions, and analyze smart contracts. What would you like to explore today?"
    ],
    "chatPrompts": [
      "Check the balance of this Avalanche address",
      "Show me recent transactions for this address",
      "What's the current AVAX price?",
      "Show me the gas prices on Avalanche"
    ]
  }
}
```

You can also add Snowtracer to existing agents by adding `"snowtracer"` to the `nodes` array in their template.json file.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Action to perform: 'address_balance', 'transactions', 'token_transfers', 'contract_abi', 'avax_price', 'gas_oracle' |
| address | string | For address actions | Avalanche address to query |
| contractAddress | string | No | Contract address for token transfers |
| limit | number | No | Maximum number of results to return (default: 10) |
| apiKey | string | No | Optional Snowtrace API key (will use environment variable if not provided) |

## Response

The tool returns formatted data based on the action:

- **address_balance**: Address balance in AVAX and Wei
- **transactions**: List of transactions with details
- **token_transfers**: List of token transfers with details
- **contract_abi**: Contract ABI with function signatures
- **avax_price**: Current AVAX price in USD and BTC
- **gas_oracle**: Current gas prices and recommendations

### Example Gas Oracle Response

```json
{
  "lastBlock": 58847886,
  "safeGasPrice": 1.1,
  "proposeGasPrice": 1.5,
  "fastGasPrice": 3.0,
  "suggestBaseFee": 1.0,
  "gasUsedRatio": "0"
}
```

This provides gas prices in Gwei (nAVAX) for different transaction speed tiers.

## API Key

To use this tool, you need a Snowtrace API key. You can:

1. Get a free API key from [Snowtrace](https://snowtrace.io/myapikey)
2. Set it as an environment variable: `SNOWTRACE_API_KEY`
3. Or pass it directly to the tool via the `apiKey` parameter

### API Rate Limits

The free tier of the Snowtrace API allows:
- 2 requests per second (rps)
- Up to 10,000 calls per day

No API key is required for the free tier. For more extensive needs, paid plans are available with higher usage limits and advanced features.

## Implementation Details

The Snowtracer tool is built on the Snowtrace API, which is compatible with the Etherscan API format. It provides access to the Avalanche C-Chain blockchain data.

The implementation is modular, with separate API clients for different aspects of the blockchain:

- **Account**: Address balances and transactions
- **Contract**: Smart contract data
- **Transaction**: Transaction details
- **Block**: Block information
- **Stats**: Network statistics
- **Gas**: Gas price information (estimated from eth_gasPrice)
- **Logs**: Event logs
- **Proxy**: Direct Ethereum JSON-RPC access

### Gas Oracle Implementation

The gas oracle feature uses a dynamic approach to determine gas price tiers based on actual network activity:

1. Makes direct RPC calls to the Avalanche C-Chain endpoint (`https://api.avax.network/ext/bc/C/rpc`)
2. Analyzes gas prices from transactions in the most recent blocks (up to 5 blocks)
3. Calculates percentile-based gas price tiers:
   - **Safe Gas Price**: 25th percentile of recent gas prices (minimum is the base fee)
   - **Proposed Gas Price**: 50th percentile of recent gas prices
   - **Fast Gas Price**: 75th percentile of recent gas prices

This approach provides truly dynamic gas price recommendations that reflect actual network usage patterns rather than using fixed formulas or hardcoded values. The implementation automatically adjusts to changing network conditions and user behavior, providing reliable gas price estimates for different transaction priorities.

The system includes multiple fallback mechanisms:
- If no recent transactions are found, it uses the current network gas price as a base for calculations
- If direct RPC calls fail, it falls back to using the Snowtrace API's `proxy/eth_gasPrice` endpoint
- Base fee information is always retrieved to ensure gas prices never go below the network minimum

This robust implementation ensures that users always receive appropriate gas price recommendations regardless of network conditions or API availability.

## Error Handling

The tool handles various error scenarios:

- Invalid addresses
- Contract not found
- API rate limiting
- Network errors
- Invalid parameters

## Dependencies

- Snowtrace API
- Zod for parameter validation
- Agentdock core utilities 