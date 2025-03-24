import { logger, LogCategory } from 'agentdock-core';

/**
 * Standardized error logging function
 * @param component Component name
 * @param action Action being performed
 * @param error Error object or message
 * @param additionalInfo Additional information to log
 */
export async function logError(
  component: string,
  action: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  try {
    await logger.error(
      LogCategory.SYSTEM,
      component,
      action,
      {
        error: errorMessage,
        ...additionalInfo
      }
    );
  } catch (e) {
    // Fallback if logger fails
    console.error(`[${component}] ${action}: ${errorMessage}`, additionalInfo);
  }
}

/**
 * Standardized info logging function
 * @param component Component name
 * @param action Action being performed
 * @param message Message to log
 * @param data Additional data to log
 */
export async function logInfo(
  component: string,
  action: string,
  message?: string,
  data?: Record<string, unknown>
) {
  try {
    await logger.info(
      LogCategory.SYSTEM,
      component,
      message || action,
      data
    );
  } catch (e) {
    // Fallback if logger fails
    console.info(`[${component}] ${message || action}`, data);
  }
}

/**
 * Standardized debug logging function
 * @param component Component name
 * @param action Action being performed
 * @param message Message to log
 * @param data Additional data to log
 */
export async function logDebug(
  component: string,
  action: string,
  message?: string,
  data?: Record<string, unknown>
) {
  try {
    await logger.debug(
      LogCategory.SYSTEM,
      component,
      message || action,
      data
    );
  } catch (e) {
    // Fallback if logger fails
    console.debug(`[${component}] ${message || action}`, data);
  }
} 