/**
 * @fileoverview Contract module for Snowtrace API
 */

import { makeRequest } from './core';

/**
 * Contract ABI response interface
 */
export interface ContractABIResponse {
  status: string;
  message: string;
  result: string; // JSON string of ABI
}

/**
 * Contract source code response interface
 */
export interface ContractSourceResponse {
  status: string;
  message: string;
  result: Array<{
    SourceCode: string;
    ABI: string;
    ContractName: string;
    CompilerVersion: string;
    OptimizationUsed: string;
    Runs: string;
    ConstructorArguments: string;
    EVMVersion: string;
    Library: string;
    LicenseType: string;
    Proxy: string;
    Implementation: string;
    SwarmSource: string;
  }>;
}

/**
 * Get contract ABI for a verified smart contract
 * @param address Contract address
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with contract ABI
 */
export async function getABI(
  address: string,
  apiKey?: string
): Promise<string> {
  const response = await makeRequest<ContractABIResponse>(
    'contract',
    'getabi',
    { address },
    apiKey
  );

  return response.result;
}

/**
 * Get source code for a verified smart contract
 * @param address Contract address
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with contract source code
 */
export async function getSourceCode(
  address: string,
  apiKey?: string
): Promise<ContractSourceResponse['result']> {
  const response = await makeRequest<ContractSourceResponse>(
    'contract',
    'getsourcecode',
    { address },
    apiKey
  );

  return response.result;
}
