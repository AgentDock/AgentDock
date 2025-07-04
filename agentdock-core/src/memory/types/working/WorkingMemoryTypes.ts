export interface WorkingMemoryData {
  id: string;
  agentId: string;
  sessionId: string;
  content: string;
  contextWindow: number;
  tokenCount: number;
  importance: number;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export interface WorkingMemoryConfig {
  maxTokens: number;
  ttlSeconds: number;
  maxContextItems: number;
  compressionThreshold: number;
  encryptSensitive: boolean;
}

export interface ContextWindow {
  memories: WorkingMemoryData[];
  totalTokens: number;
  windowSize: number;
  lastUpdated: number;
}

export interface WorkingMemoryStats {
  totalMemories: number;
  totalTokens: number;
  avgTokensPerMemory: number;
  expiredMemories: number;
  encryptedMemories: number;
  oldestMemory: number;
  newestMemory: number;
}

export interface CompressionResult {
  originalCount: number;
  compressedCount: number;
  spaceSaved: number;
}

export interface StoreOptions {
  importance?: number;
  contextWindow?: number;
  ttlSeconds?: number;
  metadata?: Record<string, any>;
  encrypt?: boolean;
  sessionId?: string; // Added for MemoryManager compatibility
}
