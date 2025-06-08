/**
 * @fileoverview Block module for Snowtrace API
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * Block reward response interface
 */
export interface BlockRewardResponse {
  status: string;
  message: string;
  result: {
    blockNumber: string;
    timeStamp: string;
    blockMiner: string;
    blockReward: string;
    uncles: Array<{
      miner: string;
      unclePosition: string;
      blockreward: string;
    }>;
    uncleInclusionReward: string;
  };
}

/**
 * Get block reward by block number
 * @param blockno Block number
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with block reward data
 */
export async function getBlockReward(
  blockno: number,
  apiKey?: string
): Promise<BlockRewardResponse['result']> {
  const response = await makeRequest<BlockRewardResponse>(
    'block',
    'getblockreward',
    { blockno: blockno.toString() },
    apiKey
  );

  return response.result;
}

/**
 * Get estimated block countdown time for a block number
 * @param blockno Block number
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with block countdown data
 */
export async function getBlockCountdown(
  blockno: number,
  apiKey?: string
): Promise<any> {
  const response = await makeRequest<SnowtraceResponse<any>>(
    'block',
    'getblockcountdown',
    { blockno: blockno.toString() },
    apiKey
  );

  return response.result;
}

/**
 * Get block number by timestamp
 * @param timestamp Unix timestamp
 * @param closest Closest type ('before' or 'after')
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with block number
 */
export async function getBlockNumberByTimestamp(
  timestamp: number,
  closest: 'before' | 'after' = 'before',
  apiKey?: string
): Promise<string> {
  const response = await makeRequest<SnowtraceResponse<string>>(
    'block',
    'getblocknobytime',
    {
      timestamp: timestamp.toString(),
      closest
    },
    apiKey
  );

  return response.result;
}
