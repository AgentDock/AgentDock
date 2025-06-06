/**
 * @fileoverview Account module for Snowtrace API
 */

import { makeRequest, SnowtraceResponse } from './core';

/**
 * Account balance response interface
 */
export interface BalanceResponse {
  status: string;
  message: string;
  result: string; // Balance in wei
}

/**
 * Account balance data interface
 */
export interface BalanceData {
  address: string;
  balance: string;
  balanceInAVAX: number;
}

/**
 * Transaction data interface
 */
export interface TransactionData {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

/**
 * Token transfer data interface
 */
export interface TokenTransferData {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

/**
 * Get AVAX balance for an address
 * @param address Avalanche address to get balance for
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with balance data
 */
export async function getBalance(
  address: string,
  apiKey?: string
): Promise<BalanceData> {
  const response = await makeRequest<BalanceResponse>(
    'account',
    'balance',
    { address, tag: 'latest' },
    apiKey
  );

  // Convert wei to AVAX (18 decimals)
  const balanceInWei = response.result;
  const balanceInAVAX = parseFloat(balanceInWei) / 1e18;

  return {
    address,
    balance: balanceInWei,
    balanceInAVAX
  };
}

/**
 * Get list of normal transactions for an address
 * @param address Avalanche address to get transactions for
 * @param startBlock Starting block number
 * @param endBlock Ending block number
 * @param page Page number
 * @param offset Number of transactions per page
 * @param sort Sort order (asc or desc)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction data
 */
export async function getTransactions(
  address: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc',
  apiKey?: string
): Promise<TransactionData[]> {
  const response = await makeRequest<SnowtraceResponse<TransactionData[]>>(
    'account',
    'txlist',
    {
      address,
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      page: page.toString(),
      offset: offset.toString(),
      sort
    },
    apiKey
  );

  return response.result;
}

/**
 * Get list of internal transactions for an address
 * @param address Avalanche address to get internal transactions for
 * @param startBlock Starting block number
 * @param endBlock Ending block number
 * @param page Page number
 * @param offset Number of transactions per page
 * @param sort Sort order (asc or desc)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with transaction data
 */
export async function getInternalTransactions(
  address: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc',
  apiKey?: string
): Promise<TransactionData[]> {
  const response = await makeRequest<SnowtraceResponse<TransactionData[]>>(
    'account',
    'txlistinternal',
    {
      address,
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      page: page.toString(),
      offset: offset.toString(),
      sort
    },
    apiKey
  );

  return response.result;
}

/**
 * Get list of ERC-20 token transfers for an address
 * @param address Avalanche address to get token transfers for
 * @param contractAddress Token contract address (optional)
 * @param startBlock Starting block number
 * @param endBlock Ending block number
 * @param page Page number
 * @param offset Number of transfers per page
 * @param sort Sort order (asc or desc)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with token transfer data
 */
export async function getTokenTransfers(
  address: string,
  contractAddress?: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc',
  apiKey?: string
): Promise<TokenTransferData[]> {
  const params: Record<string, string> = {
    address,
    startblock: startBlock.toString(),
    endblock: endBlock.toString(),
    page: page.toString(),
    offset: offset.toString(),
    sort
  };

  // Add contract address if provided
  if (contractAddress) {
    params.contractaddress = contractAddress;
  }

  const response = await makeRequest<SnowtraceResponse<TokenTransferData[]>>(
    'account',
    'tokentx',
    params,
    apiKey
  );

  return response.result;
}

/**
 * Get list of ERC-721 (NFT) token transfers for an address
 * @param address Avalanche address to get NFT transfers for
 * @param contractAddress Token contract address (optional)
 * @param startBlock Starting block number
 * @param endBlock Ending block number
 * @param page Page number
 * @param offset Number of transfers per page
 * @param sort Sort order (asc or desc)
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with token transfer data
 */
export async function getNFTTransfers(
  address: string,
  contractAddress?: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc',
  apiKey?: string
): Promise<TokenTransferData[]> {
  const params: Record<string, string> = {
    address,
    startblock: startBlock.toString(),
    endblock: endBlock.toString(),
    page: page.toString(),
    offset: offset.toString(),
    sort
  };

  // Add contract address if provided
  if (contractAddress) {
    params.contractaddress = contractAddress;
  }

  const response = await makeRequest<SnowtraceResponse<TokenTransferData[]>>(
    'account',
    'tokennfttx',
    params,
    apiKey
  );

  return response.result;
}

/**
 * Get token balance for a specific token and address
 * @param address Avalanche address to get token balance for
 * @param contractAddress Token contract address
 * @param apiKey Snowtrace API key (optional)
 * @returns Promise with token balance
 */
export async function getTokenBalance(
  address: string,
  contractAddress: string,
  apiKey?: string
): Promise<string> {
  const response = await makeRequest<BalanceResponse>(
    'account',
    'tokenbalance',
    {
      address,
      contractaddress: contractAddress,
      tag: 'latest'
    },
    apiKey
  );

  return response.result;
}
