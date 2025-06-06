/**
 * @fileoverview Transaction module for Snowtrace API
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * Transaction receipt status response interface
 */
export interface TxReceiptStatusResponse {
  status: string;
  message: string;
  result: {
    status: string; // 0 = Fail, 1 = Pass
  };
}

/**
 * Get transaction receipt status
 * @param txhash Transaction hash
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction receipt status
 */
export async function getTransactionStatus(
  txhash: string,
  apiKey?: string
): Promise<string> {
  const response = await makeRequest<TxReceiptStatusResponse>(
    'transaction',
    'gettxreceiptstatus',
    { txhash },
    apiKey
  );

  return response.result.status;
}

/**
 * Get transaction execution status
 * @param txhash Transaction hash
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction execution status
 */
export async function getTransactionExecutionStatus(
  txhash: string,
  apiKey?: string
): Promise<any> {
  const response = await makeRequest<SnowtraceResponse<any>>(
    'transaction',
    'getstatus',
    { txhash },
    apiKey
  );

  return response.result;
}
