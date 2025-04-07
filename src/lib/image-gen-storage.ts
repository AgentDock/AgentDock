// src/lib/image-gen-storage.ts
import { logger, LogCategory, StorageProvider } from 'agentdock-core'; // Added StorageProvider

// Define the structure of a history item (matching page.tsx)
interface HistoryPart {
  text?: string;
  image?: string; // Assuming image data/URL is stored as string
}

export interface HistoryItem {
  role: "user" | "model";
  parts: HistoryPart[];
}

// --- Constants ---
const HISTORY_KEY_PREFIX = 'image-gen-history:';
const MAX_HISTORY_LENGTH = 50; // Limit the number of entries stored
const COMPONENT_NAME = 'ImageGenStorage'; // Define component name for logging

// --- Helper Functions ---
function getHistoryKey(sessionId: string): string {
  return `${HISTORY_KEY_PREFIX}${sessionId}`;
}

// --- Core Functions ---

/**
 * Loads image generation history for a given session ID using the provided storage provider.
 * Returns an empty array if no history is found or an error occurs.
 */
export async function loadImageGenHistory(
  provider: StorageProvider, // Added provider argument
  sessionId: string
): Promise<HistoryItem[]> {
  if (!sessionId) {
    logger.warn(LogCategory.STORAGE, COMPONENT_NAME, 'Attempted to load history without a session ID.');
    return [];
  }
  const key = getHistoryKey(sessionId);
  try {
    // Use provider.getList, explicitly requesting ALL items (0 to -1)
    const history = await provider.getList<HistoryItem>(key, 0, -1);
    logger.debug(LogCategory.STORAGE, COMPONENT_NAME, `Loaded ${history?.length ?? 0} history items for session ${sessionId}`);
    return history ?? [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(LogCategory.STORAGE, COMPONENT_NAME, `Failed to load history for session ${sessionId}: ${errorMessage}`, { error });
    return []; // Return empty array on error to avoid breaking the UI
  }
}

/**
 * Saves image generation history for a given session ID using the provided storage provider.
 * Limits the history length to MAX_HISTORY_LENGTH.
 */
export async function saveImageGenHistory(
  provider: StorageProvider, // Added provider argument
  sessionId: string, 
  history: HistoryItem[]
): Promise<void> {
   if (!sessionId) {
    logger.warn(LogCategory.STORAGE, COMPONENT_NAME, 'Attempted to save history without a session ID.');
    return;
  }
  if (!Array.isArray(history)) {
     logger.warn(LogCategory.STORAGE, COMPONENT_NAME, `Attempted to save invalid history data type for session ${sessionId}. Expected array.`);
     return;
  }

  const key = getHistoryKey(sessionId);
  // Only store the most recent entries if history exceeds the limit
  const historyToSave = history.slice(-MAX_HISTORY_LENGTH);
  
  try {
    // Use provider.saveList for atomic replace
    await provider.saveList(key, historyToSave);
    logger.debug(LogCategory.STORAGE, COMPONENT_NAME, `Saved ${historyToSave.length} history items for session ${sessionId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(LogCategory.STORAGE, COMPONENT_NAME, `Failed to save history for session ${sessionId}: ${errorMessage}`, { error });
     // Decide if the error should be thrown or handled gracefully
     // throw error; // Uncomment to propagate the error
  }
}

/**
 * Clears image generation history for a given session ID using the provided storage provider.
 */
export async function clearImageGenHistory(
  provider: StorageProvider, // Added provider argument
  sessionId: string
): Promise<void> {
  if (!sessionId) {
     logger.warn(LogCategory.STORAGE, COMPONENT_NAME, 'Attempted to clear history without a session ID.');
     return;
   }
  const key = getHistoryKey(sessionId);
  try {
    // Use provider.deleteList instead of kv.del
    await provider.deleteList(key);
    logger.info(LogCategory.STORAGE, COMPONENT_NAME, `Cleared history for session ${sessionId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(LogCategory.STORAGE, COMPONENT_NAME, `Failed to clear history for session ${sessionId}: ${errorMessage}`, { error });
     // Decide if the error should be thrown or handled gracefully
     // throw error; // Uncomment to propagate the error
  }
}