/**
 * @fileoverview UI components for rendering Snowtracer data
 */

import { BalanceData, TransactionData, TokenTransferData } from './api/account';
import { AVAXPriceData } from './api/stats';
import { GasOracleData } from './api/gas';

/**
 * Helper function to format AVAX amount
 */
export function formatAVAX(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Helper function to format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Helper function to format large numbers
 */
export function formatNumber(num: number | string): string {
  const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-US').format(parsedNum);
}

/**
 * Helper function to format timestamp
 */
export function formatTimestamp(timestamp: number | string): string {
  const date = typeof timestamp === 'string' 
    ? new Date(parseInt(timestamp) * 1000)
    : new Date(timestamp * 1000);
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Helper function to truncate address
 */
export function truncateAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Address balance component
 */
export function AddressBalance(props: BalanceData) {
  return {
    type: 'address_balance',
    content: `## Address Balance: ${truncateAddress(props.address)}

**AVAX Balance:** ${formatAVAX(props.balanceInAVAX)} AVAX
**Wei Balance:** ${formatNumber(props.balance)} wei

_Data provided by Snowtrace_`
  };
}

/**
 * Transaction list component
 */
export function TransactionList(props: { address: string, transactions: TransactionData[] }) {
  const { address, transactions } = props;
  
  if (transactions.length === 0) {
    return {
      type: 'transaction_list',
      content: `## Transactions for ${truncateAddress(address)}

No transactions found for this address.

_Data provided by Snowtrace_`
    };
  }
  
  const transactionItems = transactions.map(tx => {
    const value = parseFloat(tx.value) / 1e18;
    const timestamp = formatTimestamp(tx.timeStamp);
    const status = tx.isError === '0' ? '✅' : '❌';
    
    return `- **${status} ${tx.hash.substring(0, 10)}...** | ${timestamp}
  - From: ${truncateAddress(tx.from)} → To: ${truncateAddress(tx.to)}
  - Value: ${formatAVAX(value)} AVAX | Gas Used: ${formatNumber(tx.gasUsed)}`;
  }).join('\n\n');
  
  return {
    type: 'transaction_list',
    content: `## Transactions for ${truncateAddress(address)}

${transactionItems}

_Data provided by Snowtrace_`
  };
}

/**
 * Token transfer list component
 */
export function TokenTransferList(props: { address: string, transfers: TokenTransferData[] }) {
  const { address, transfers } = props;
  
  if (transfers.length === 0) {
    return {
      type: 'token_transfer_list',
      content: `## Token Transfers for ${truncateAddress(address)}

No token transfers found for this address.

_Data provided by Snowtrace_`
    };
  }
  
  const transferItems = transfers.map(transfer => {
    const decimals = parseInt(transfer.tokenDecimal);
    const value = parseFloat(transfer.value) / Math.pow(10, decimals);
    const timestamp = formatTimestamp(transfer.timeStamp);
    const direction = transfer.from.toLowerCase() === address.toLowerCase() ? 'OUT' : 'IN';
    
    return `- **${direction} ${transfer.hash.substring(0, 10)}...** | ${timestamp}
  - ${direction === 'OUT' ? 'To' : 'From'}: ${truncateAddress(direction === 'OUT' ? transfer.to : transfer.from)}
  - Token: ${transfer.tokenName} (${transfer.tokenSymbol})
  - Amount: ${formatNumber(value)} ${transfer.tokenSymbol}`;
  }).join('\n\n');
  
  return {
    type: 'token_transfer_list',
    content: `## Token Transfers for ${truncateAddress(address)}

${transferItems}

_Data provided by Snowtrace_`
  };
}

/**
 * Contract ABI component
 */
export function ContractABI(props: { address: string, abi: string }) {
  const { address, abi } = props;
  
  try {
    // Parse ABI to get function names
    const parsedABI = JSON.parse(abi);
    const functions = parsedABI
      .filter((item: any) => item.type === 'function')
      .map((item: any) => {
        const inputs = item.inputs?.map((input: any) => `${input.type} ${input.name || ''}`).join(', ') || '';
        const outputs = item.outputs?.map((output: any) => output.type).join(', ') || '';
        return `- ${item.name}(${inputs}) ${outputs ? `→ (${outputs})` : ''}`;
      })
      .join('\n');
    
    return {
      type: 'contract_abi',
      content: `## Contract ABI: ${truncateAddress(address)}

### Functions:
${functions}

_Data provided by Snowtrace_`
    };
  } catch (error) {
    return {
      type: 'contract_abi',
      content: `## Contract ABI: ${truncateAddress(address)}

Failed to parse ABI. Raw ABI data:
\`\`\`
${abi.substring(0, 500)}${abi.length > 500 ? '...' : ''}
\`\`\`

_Data provided by Snowtrace_`
    };
  }
}

/**
 * AVAX price component
 */
export function AVAXPrice(props: AVAXPriceData) {
  return {
    type: 'avax_price',
    content: `## AVAX Price

**USD:** ${formatCurrency(props.avaxUSD)}
**BTC:** ${props.avaxBTC.toFixed(8)} BTC

Last Updated: ${props.lastUpdated.toLocaleString()}

_Data provided by Snowtrace_`
  };
}

/**
 * Gas oracle component
 */
export function GasOracle(props: GasOracleData) {
  return {
    type: 'gas_oracle',
    content: `## Avalanche Gas Oracle

**Safe Gas Price:** ${props.safeGasPrice.toFixed(2)} Gwei
**Proposed Gas Price:** ${props.proposeGasPrice.toFixed(2)} Gwei
**Fast Gas Price:** ${props.fastGasPrice.toFixed(2)} Gwei
**Base Fee:** ${props.suggestBaseFee.toFixed(2)} Gwei

${props.lastBlock > 0 ? `Last Block: ${props.lastBlock}` : ''}
${props.gasUsedRatio !== "0" ? `Gas Used Ratio: ${props.gasUsedRatio}` : ''}

_Note: Gas prices are estimated based on current network conditions_
_Data provided by Snowtrace_`
  };
}

/**
 * Error component
 */
export function ErrorMessage(props: { title: string, message: string }) {
  return {
    type: 'snowtracer_error',
    content: `## ${props.title}

${props.message}

_Please check your input and try again._`
  };
} 