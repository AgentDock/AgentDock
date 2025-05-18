/**
 * @fileoverview Proxy module for Snowtrace API (direct Ethereum JSON-RPC access)
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * Get block number
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with current block number
 */
export async function getBlockNumber(apiKey?: string): Promise<string> {
  const response = await makeRequest<SnowtraceResponse<string>>(
    'proxy',
    'eth_blockNumber',
    {},
    apiKey,
  );

  return response.result;
}

/**
 * Get block by number
 * @param tag Block number or tag (latest, earliest, pending)
 * @param boolean Boolean to include full transaction objects
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with block data
 */
export async function getBlockByNumber(
  tag: string | number,
  boolean: boolean = true,
  apiKey?: string,
): Promise<any> {
  // Convert number to hex if needed
  const blockTag = typeof tag === 'number' ? `0x${tag.toString(16)}` : tag;

  const response = await makeRequest<SnowtraceResponse<any>>(
    'proxy',
    'eth_getBlockByNumber',
    {
      tag: blockTag,
      boolean: boolean.toString(),
    },
    apiKey,
  );

  return response.result;
}

/**
 * Get transaction by hash
 * @param txhash Transaction hash
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction data
 */
export async function getTransactionByHash(txhash: string, apiKey?: string): Promise<any> {
  const response = await makeRequest<SnowtraceResponse<any>>(
    'proxy',
    'eth_getTransactionByHash',
    { txhash },
    apiKey,
  );

  return response.result;
}

/**
 * Get transaction receipt
 * @param txhash Transaction hash
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction receipt
 */
export async function getTransactionReceipt(txhash: string, apiKey?: string): Promise<any> {
  const response = await makeRequest<SnowtraceResponse<any>>(
    'proxy',
    'eth_getTransactionReceipt',
    { txhash },
    apiKey,
  );

  return response.result;
}

/**
 * Call a contract function
 * @param to Contract address
 * @param data Function call data
 * @param tag Block number or tag (latest, earliest, pending)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with call result
 */
export async function call(
  to: string,
  data: string,
  tag: string = 'latest',
  apiKey?: string,
): Promise<string> {
  const response = await makeRequest<SnowtraceResponse<string>>(
    'proxy',
    'eth_call',
    {
      to,
      data,
      tag,
    },
    apiKey,
  );

  return response.result;
}

/**
 * Get code at address
 * @param address Address to get code from
 * @param tag Block number or tag (latest, earliest, pending)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with contract code
 */
export async function getCode(
  address: string,
  tag: string = 'latest',
  apiKey?: string,
): Promise<string> {
  const response = await makeRequest<SnowtraceResponse<string>>(
    'proxy',
    'eth_getCode',
    {
      address,
      tag,
    },
    apiKey,
  );

  return response.result;
}
