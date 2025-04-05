/**
 * @fileoverview Snowtracer tool implementation for Avalanche blockchain data
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions, ToolCollection } from '../types';
import * as snowtraceAPI from './api';
import { 
  AddressBalance, 
  TransactionList, 
  TokenTransferList, 
  ContractABI, 
  AVAXPrice, 
  GasOracle, 
  ErrorMessage 
} from './components';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for Snowtracer tool parameters
 */
const snowtracerSchema = z.object({
  action: z.enum([
    'address_balance',
    'transactions',
    'token_transfers',
    'contract_abi',
    'avax_price',
    'gas_oracle'
  ]).describe('Action to perform'),
  
  address: z.string().optional().describe('Avalanche address to query (required for address-specific actions)'),
  
  contractAddress: z.string().optional().describe('Contract address for token transfers'),
  
  limit: z.number().optional().default(10).describe('Maximum number of results to return'),
  
  apiKey: z.string().optional().describe('Optional Snowtrace API key (will use environment variable if not provided)')
});

/**
 * Type inference from schema
 */
type SnowtracerParams = z.infer<typeof snowtracerSchema>;

/**
 * Snowtracer tool implementation
 */
export const snowtracerTool: Tool = {
  name: 'snowtracer',
  description: 'Get blockchain data from the Avalanche network using Snowtrace',
  parameters: snowtracerSchema,
  
  async execute({ action, address, contractAddress, limit = 10, apiKey }: SnowtracerParams, options: ToolExecutionOptions) {
    try {
      logger.debug(LogCategory.NODE, '[Snowtracer]', `Executing action: ${action}`);
      
      // Validate address for address-specific actions
      if (['address_balance', 'transactions', 'token_transfers', 'contract_abi'].includes(action) && !address) {
        throw new Error(`Address is required for action: ${action}`);
      }
      
      // Execute the requested action
      switch (action) {
        case 'address_balance':
          return await getAddressBalance(address!, apiKey);
          
        case 'transactions':
          return await getTransactions(address!, limit, apiKey);
          
        case 'token_transfers':
          return await getTokenTransfers(address!, contractAddress, limit, apiKey);
          
        case 'contract_abi':
          return await getContractABI(address!, apiKey);
          
        case 'avax_price':
          return await getAVAXPrice(apiKey);
          
        case 'gas_oracle':
          return await getGasOracle(apiKey);
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      // Log error
      logger.error(LogCategory.NODE, '[Snowtracer]', `Error executing action: ${action}`, { error });
      
      // Return error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return ErrorMessage({ 
        title: 'Snowtracer Error', 
        message: `Failed to execute action '${action}': ${errorMessage}` 
      });
    }
  }
};

/**
 * Get address balance
 */
async function getAddressBalance(address: string, apiKey?: string) {
  const balanceData = await snowtraceAPI.account.getBalance(address, apiKey);
  return AddressBalance(balanceData);
}

/**
 * Get transactions for address
 */
async function getTransactions(address: string, limit: number, apiKey?: string) {
  const transactions = await snowtraceAPI.account.getTransactions(address, 0, 99999999, 1, limit, 'desc', apiKey);
  return TransactionList({ address, transactions });
}

/**
 * Get token transfers for address
 */
async function getTokenTransfers(address: string, contractAddress: string | undefined, limit: number, apiKey?: string) {
  const transfers = await snowtraceAPI.account.getTokenTransfers(address, contractAddress, 0, 99999999, 1, limit, 'desc', apiKey);
  return TokenTransferList({ address, transfers });
}

/**
 * Get contract ABI
 */
async function getContractABI(address: string, apiKey?: string) {
  const abi = await snowtraceAPI.contract.getABI(address, apiKey);
  return ContractABI({ address, abi });
}

/**
 * Get AVAX price
 */
async function getAVAXPrice(apiKey?: string) {
  const priceData = await snowtraceAPI.stats.getAVAXPrice(apiKey);
  return AVAXPrice(priceData);
}

/**
 * Get gas oracle data
 */
async function getGasOracle(apiKey?: string) {
  const gasData = await snowtraceAPI.gas.getGasOracle(apiKey);
  return GasOracle(gasData);
}

// Export tools for registry
export const tools: ToolCollection = {
  snowtracer: snowtracerTool
}; 