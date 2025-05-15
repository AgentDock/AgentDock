// agentdock-core/src/llm/providers/cerebras-adapter.ts

import { ModelService } from "../model-service";
import { ModelMetadata } from "../types";
import { logger, LogCategory } from "../../logging";

const CEREBRAS_API_BASE = process.env.CEREBRAS_API_URL || "https://api.cerebras.ai/v1";

/**
 * Normalize Cerebras API key to ensure it has the correct format
 * @param apiKey The API key to normalize
 * @returns The normalized API key
 */
function normalizeApiKey(apiKey: string): string {
  // The Cerebras API accepts both csk- and csk_ formats
  // But we'll standardize on csk- format
  const normalized = apiKey.startsWith("csk_") ? apiKey.replace("csk_", "csk-") : apiKey;
  logger.debug(
    LogCategory.LLM,
    "[CerebrasAdapter]",
    `Normalized API key format: ${normalized.substring(0, 7)}...`
  );
  return normalized;
}

/**
 * Validate a Cerebras API key
 */
export async function validateCerebrasApiKey(
  apiKey: string | undefined
): Promise<boolean> {
  try {
    if (!apiKey) {
      logger.warn(
        LogCategory.LLM,
        "[CerebrasAdapter]",
        "API key validation failed: Key is undefined or empty"
      );
      return false;
    }

    if (!apiKey.startsWith("csk-") && !apiKey.startsWith("csk_")) {
      logger.warn(
        LogCategory.LLM,
        "[CerebrasAdapter]",
        "API key validation failed: Key must start with csk- or csk_"
      );
      return false;
    }

    const normalizedKey = normalizeApiKey(apiKey);

    logger.debug(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      `Validating API key format: ${apiKey.substring(0, 7)}...`
    );

    const response = await fetch(`${CEREBRAS_API_BASE}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizedKey}`,
        "Content-Type": "application/json",
        "User-Agent": "AgentDock/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logger.warn(
        LogCategory.LLM,
        "[CerebrasAdapter]",
        `API validation failed with status ${response.status}`
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      "Error validating API key:",
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return false;
  }
}

export async function fetchCerebrasModels(
  apiKey: string | undefined
): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      logger.error(
        LogCategory.LLM,
        "[CerebrasAdapter]",
        "Cannot fetch models: API key is undefined or empty"
      );
      throw new Error("API key is required");
    }

    const normalizedKey = normalizeApiKey(apiKey);

    logger.debug(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      "Fetching models from Cerebras API"
    );

    const response = await fetch(`${CEREBRAS_API_BASE}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizedKey}`,
        "Content-Type": "application/json",
        "User-Agent": "AgentDock/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logger.debug(
        LogCategory.LLM,
        "[CerebrasAdapter]",
        `API response: ${response.status} ${response.statusText}`
      );
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();

    logger.debug(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      `API response data: ${JSON.stringify(data).substring(0, 100)}...`
    );

    if (!data || !data.object || data.object !== "list" || !Array.isArray(data.data)) {
      throw new Error("Invalid model list returned from Cerebras");
    }

    // Map of model IDs to their known parameters and capabilities
    const modelMetadataMap: Record<string, Partial<ModelMetadata>> = {
      "llama3.1-8b": {
        displayName: "llama3.1-8b",
        description: "Cerebras model: llama3.1-8b",
        contextWindow: 8192,
        capabilities: ["text-generation", "reasoning"],
      },
      "llama-3.3-70b": {
        displayName: "llama-3.3-70b",
        description: "Cerebras model: llama-3.3-70b",
        contextWindow: 8192,
        capabilities: ["text-generation", "reasoning"],
      },
      "llama-4-scout-17b-16e-instruct": {
        displayName: "llama-4-scout-17b-16e-instruct",
        description: "Cerebras model: llama-4-scout-17b-16e-instruct",
        contextWindow: 8192,
        capabilities: ["text-generation", "reasoning"],
      },
    };

    const models: ModelMetadata[] = data.data.map((model: any) => {
      const baseMetadata = modelMetadataMap[model.id] || {};

      return {
        id: model.id,
        displayName: baseMetadata.displayName || model.id,
        description: baseMetadata.description || `Cerebras model: ${model.id}`,
        contextWindow: baseMetadata.contextWindow || 8192,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: baseMetadata.capabilities || ["text-generation", "reasoning"],
      };
    });

    ModelService.registerModels("cerebras", models);

    logger.debug(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      `Fetched ${models.length} models`
    );

    return ModelService.getModels("cerebras");
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      "[CerebrasAdapter]",
      "Error fetching models:",
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
    throw error;
  }
}
