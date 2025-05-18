/**
 * @fileoverview Logs module for Snowtrace API
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * Get event logs by address and topics
 * @param address Contract address
 * @param fromBlock Starting block number
 * @param toBlock Ending block number
 * @param topic0 First topic (event signature)
 * @param topic1 Second topic (optional)
 * @param topic2 Third topic (optional)
 * @param topic3 Fourth topic (optional)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with event logs
 */
export async function getLogs(
  address: string,
  fromBlock: number,
  toBlock: number,
  topic0: string,
  topic1?: string,
  topic2?: string,
  topic3?: string,
  apiKey?: string,
): Promise<any[]> {
  const params: Record<string, string> = {
    address,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    topic0,
  };

  // Add optional topics if provided
  if (topic1) params.topic1 = topic1;
  if (topic2) params.topic2 = topic2;
  if (topic3) params.topic3 = topic3;

  const response = await makeRequest<SnowtraceResponse<any[]>>('logs', 'getLogs', params, apiKey);

  return response.result;
}
