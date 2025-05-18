'use server';

import { logger, LogCategory, StorageProvider } from 'agentdock-core';
import { getStorageProvider } from '@/lib/orchestration-adapter';
import {
  HistoryItem,
  loadImageGenHistory as coreLoadImageGenHistory,
  saveImageGenHistory as coreSaveImageGenHistory,
  clearImageGenHistory as coreClearImageGenHistory,
} from '@/lib/image-gen-storage';

async function getProviderOrThrow(): Promise<StorageProvider> {
  try {
    const provider = getStorageProvider();
    if (!provider) {
      throw new Error('Storage provider could not be initialized.');
    }
    logger.debug(LogCategory.STORAGE, 'HistoryActions', 'Server-side provider obtained', {
      providerName: provider.constructor.name,
    });
    return provider;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'HistoryActions',
      'Failed to get server-side storage provider',
      { error },
    );
    throw new Error('Failed to initialize storage provider on server.');
  }
}

export async function loadHistoryAction(sessionId: string): Promise<HistoryItem[]> {
  logger.info(LogCategory.STORAGE, 'HistoryActions', 'loadHistoryAction called', { sessionId });
  if (!sessionId) return [];
  try {
    const provider = await getProviderOrThrow();
    return await coreLoadImageGenHistory(provider, sessionId);
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'HistoryActions', 'Error in loadHistoryAction', {
      sessionId,
      error,
    });
    // Return empty array or re-throw, depending on desired client behavior
    return [];
  }
}

export async function saveHistoryAction(sessionId: string, history: HistoryItem[]): Promise<void> {
  logger.info(LogCategory.STORAGE, 'HistoryActions', 'saveHistoryAction called', {
    sessionId,
    historyLength: history.length,
  });
  if (!sessionId || !history) return;
  try {
    const provider = await getProviderOrThrow();
    await coreSaveImageGenHistory(provider, sessionId, history);
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'HistoryActions', 'Error in saveHistoryAction', {
      sessionId,
      error,
    });
    // Re-throw might be appropriate here so client knows save failed
    throw error;
  }
}

export async function clearHistoryAction(sessionId: string): Promise<void> {
  logger.info(LogCategory.STORAGE, 'HistoryActions', 'clearHistoryAction called', { sessionId });
  if (!sessionId) return;
  try {
    const provider = await getProviderOrThrow();
    await coreClearImageGenHistory(provider, sessionId);
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'HistoryActions', 'Error in clearHistoryAction', {
      sessionId,
      error,
    });
    // Re-throw might be appropriate here
    throw error;
  }
}
