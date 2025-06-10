/**
 * @fileoverview Gas tracker module for Snowtrace API
 */

import { makeRequest } from './core';

/**
 * Gas price response interface for RPC endpoint
 */
export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
}

/**
 * Block data interface
 */
interface BlockData {
  baseFeePerGas: string;
  number: string;
  transactions: Transaction[];
  // Other block fields omitted for brevity
}

/**
 * Transaction interface
 */
interface Transaction {
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  // Other transaction fields omitted for brevity
}

/**
 * Gas oracle data interface
 */
export interface GasOracleData {
  lastBlock: number;
  safeGasPrice: number;
  proposeGasPrice: number;
  fastGasPrice: number;
  suggestBaseFee: number;
  gasUsedRatio: string;
}

/**
 * Convert hex string to Gwei
 * @param hexValue Hex string
 * @returns Number in Gwei
 */
function hexToGwei(hexValue: string): number {
  if (!hexValue) return 0;
  // Remove '0x' prefix if present
  const hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
  // Convert hex to decimal (wei)
  const wei = parseInt(hex, 16);
  // Convert wei to gwei
  return wei / 1e9;
}

/**
 * Make a JSON-RPC request to the Avalanche C-Chain
 * @param method RPC method
 * @param params RPC parameters
 * @returns Promise with the response
 */
async function rpcRequest<T>(method: string, params: any[] = []): Promise<T> {
  const url = 'https://api.avax.network/ext/bc/C/rpc';
  const payload = {
    jsonrpc: '2.0',
    method,
    params,
    id: 1
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(
      `RPC request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(
      `RPC error: ${data.error.message || JSON.stringify(data.error)}`
    );
  }

  return data.result;
}

/**
 * Get gas prices from recent blocks
 * @returns Promise with an array of gas prices in Gwei
 */
async function getRecentGasPrices(): Promise<number[]> {
  // Get current block number
  const blockNumberHex = await rpcRequest<string>('eth_blockNumber');
  const blockNumber = parseInt(blockNumberHex, 16);

  const gasPrices: number[] = [];

  // Analyze the last 5 blocks
  const blocksToAnalyze = 5;
  const promises: Promise<BlockData>[] = [];

  for (let i = 0; i < blocksToAnalyze; i++) {
    const blockHex = '0x' + (blockNumber - i).toString(16);
    promises.push(
      rpcRequest<BlockData>('eth_getBlockByNumber', [blockHex, true])
    );
  }

  const blocks = await Promise.all(promises);

  // Collect gas prices from all transactions
  blocks.forEach((block) => {
    if (block.transactions && block.transactions.length > 0) {
      block.transactions.forEach((tx) => {
        if (tx.gasPrice) {
          const gasPrice = hexToGwei(tx.gasPrice);
          if (gasPrice > 0) {
            gasPrices.push(gasPrice);
          }
        }
      });
    }
  });

  return gasPrices;
}

/**
 * Get gas oracle
 * @param apiKey Snowtrace API key (optional, not used in this implementation)
 * @returns Promise with gas oracle data
 */
export async function getGasOracle(apiKey?: string): Promise<GasOracleData> {
  try {
    // Get base fee from the latest block
    const latestBlock = await rpcRequest<BlockData>('eth_getBlockByNumber', [
      'latest',
      false
    ]);
    const baseFeeGwei = hexToGwei(latestBlock.baseFeePerGas || '0x0');
    const blockNumber = parseInt(latestBlock.number, 16);

    // Get gas prices from recent transactions
    const gasPrices = await getRecentGasPrices();

    // If we have enough gas prices, calculate percentiles
    if (gasPrices.length > 0) {
      // Sort gas prices in ascending order
      gasPrices.sort((a, b) => a - b);

      // Calculate percentiles for different speed tiers
      const safeIndex = Math.floor(gasPrices.length * 0.25); // 25th percentile for safe
      const proposeIndex = Math.floor(gasPrices.length * 0.5); // 50th percentile for standard
      const fastIndex = Math.floor(gasPrices.length * 0.75); // 75th percentile for fast

      // Get the gas prices at each percentile
      const safeGasPrice = Math.max(
        gasPrices[safeIndex] || baseFeeGwei,
        baseFeeGwei
      );
      const proposeGasPrice = Math.max(
        gasPrices[proposeIndex] || safeGasPrice * 1.2,
        safeGasPrice * 1.2
      );
      const fastGasPrice = Math.max(
        gasPrices[fastIndex] || proposeGasPrice * 1.5,
        proposeGasPrice * 1.5
      );

      return {
        lastBlock: blockNumber,
        safeGasPrice,
        proposeGasPrice,
        fastGasPrice,
        suggestBaseFee: baseFeeGwei,
        gasUsedRatio: '0' // We don't have this info
      };
    } else {
      // Fallback if no transactions found
      // Get current gas price
      const gasPrice = await rpcRequest<string>('eth_gasPrice');
      const gasPriceGwei = hexToGwei(gasPrice);

      // Use the current gas price as a base for calculations
      const safeGasPrice = Math.max(gasPriceGwei, baseFeeGwei);
      const proposeGasPrice = safeGasPrice * 1.2; // 20% higher for standard
      const fastGasPrice = safeGasPrice * 2; // 100% higher for fast

      return {
        lastBlock: blockNumber,
        safeGasPrice,
        proposeGasPrice,
        fastGasPrice,
        suggestBaseFee: baseFeeGwei,
        gasUsedRatio: '0' // We don't have this info
      };
    }
  } catch (error) {
    // Fallback to the original implementation if the direct RPC call fails
    try {
      console.warn(
        'Failed to fetch gas data from RPC, falling back to Snowtrace API:',
        error
      );
      const response = await makeRequest<{
        jsonrpc: string;
        id: number;
        result: string;
      }>('proxy', 'eth_gasPrice', {}, apiKey);

      const gasPrice = parseInt(response.result, 16);
      const gasPriceGwei = gasPrice / 1e9;

      return {
        lastBlock: 0,
        safeGasPrice: gasPriceGwei,
        proposeGasPrice: gasPriceGwei * 1.2,
        fastGasPrice: gasPriceGwei * 2,
        suggestBaseFee: gasPriceGwei,
        gasUsedRatio: '0'
      };
    } catch (fallbackError) {
      if (fallbackError instanceof Error) {
        throw new Error(`Failed to fetch gas price: ${fallbackError.message}`);
      }
      throw new Error('Failed to fetch gas price: Unknown error');
    }
  }
}
