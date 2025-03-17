# Avalanche Explorer Agent

An AI agent for exploring and analyzing data from the Avalanche blockchain using the Snowtrace API.

## Features

- **Address Analysis**: Check balances and transaction history for any Avalanche address
- **Token Tracking**: View token transfers and balances for addresses
- **Contract Exploration**: Access and explain contract ABIs and source code
- **Network Monitoring**: Get AVAX price and gas oracle data
- **Blockchain Education**: Learn about Avalanche blockchain concepts and technology

## Example Queries

- "Check the balance of this Avalanche address: 0xA713fc94db054AA435AF4d9c66c3433dCA98559F"
- "Show me recent transactions for this address: 0xA713fc94db054AA435AF4d9c66c3433dCA98559F"
- "What's the current AVAX price?"
- "Show me the gas prices on Avalanche"
- "Explain how smart contracts work on Avalanche"
- "What are the different chains in Avalanche?"
- "Show me token transfers for this address: 0xA713fc94db054AA435AF4d9c66c3433dCA98559F"
- "Get the ABI for this contract: 0xA713fc94db054AA435AF4d9c66c3433dCA98559F"

## Tools Used

This agent uses the following tools:

- **Snowtracer**: Access Avalanche blockchain data through the Snowtrace API
- **Search**: Search the web for information about Avalanche
- **Deep Research**: Perform in-depth research on blockchain topics

## Implementation Details

The Avalanche Explorer agent leverages the Snowtracer tool to access blockchain data through the Snowtrace API. The agent is designed to:

1. Validate Avalanche addresses before querying
2. Interpret blockchain data in user-friendly terms
3. Provide educational context about blockchain concepts
4. Proactively fetch relevant data when addresses are mentioned

## API Key Requirements

To use this agent effectively, you need to set up a Snowtrace API key:

1. Get a free API key from [Snowtrace](https://snowtrace.io/myapikey)
2. Set it as an environment variable: `SNOWTRACE_API_KEY`

## Limitations

- The agent primarily provides data for the Avalanche C-Chain
- Free API keys have rate limits (25 requests per day)
- Some contract interactions may require additional context to interpret correctly 