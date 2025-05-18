/**
 * @fileoverview Helper functions for error handling
 */

import { logger, LogCategory } from 'agentdock-core';

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown): string {
  let message = 'Unknown error occurred while accessing PubMed API';

  if (error instanceof Error) {
    message = `PubMed API error: ${error.message}`;
  } else if (typeof error === 'string') {
    message = `PubMed API error: ${error}`;
  }

  logger.error(LogCategory.NODE, '[PubMedAPI]', message);
  return message;
}
