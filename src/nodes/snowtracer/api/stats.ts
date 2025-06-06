/**
 * @fileoverview Stats module for Snowtrace API
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * AVAX price response interface
 */
export interface AVAXPriceResponse {
  status: string;
  message: string;
  result: {
    ethbtc: string;
    ethbtc_timestamp: string;
    ethusd: string;
    ethusd_timestamp: string;
  };
}

/**
 * AVAX price data interface
 */
export interface AVAXPriceData {
  avaxBTC: number;
  avaxUSD: number;
  lastUpdated: Date;
}

/**
 * Get AVAX price
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with AVAX price data
 */
export async function getAVAXPrice(apiKey?: string): Promise<AVAXPriceData> {
  const response = await makeRequest<AVAXPriceResponse>(
    'stats',
    'ethprice',
    {},
    apiKey
  );

  const timestamp = parseInt(response.result.ethbtc_timestamp) * 1000;

  return {
    avaxBTC: parseFloat(response.result.ethbtc),
    avaxUSD: parseFloat(response.result.ethusd),
    lastUpdated: new Date(timestamp)
  };
}

/**
 * Get AVAX supply
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with AVAX supply
 */
export async function getAVAXSupply(apiKey?: string): Promise<string> {
  const response = await makeRequest<SnowtraceResponse<string>>(
    'stats',
    'ethsupply',
    {},
    apiKey
  );

  return response.result;
}

/**
 * Get node count
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with node count
 */
export async function getNodeCount(apiKey?: string): Promise<any> {
  const response = await makeRequest<SnowtraceResponse<any>>(
    'stats',
    'nodecount',
    {},
    apiKey
  );

  return response.result;
}
