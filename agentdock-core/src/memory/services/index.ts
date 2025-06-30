/**
 * @fileoverview Memory Services - Core processing and orchestration services
 *
 * Provides high-level services for memory processing, recall, and conversation handling.
 */

// Core Services
export { EncryptionService } from './EncryptionService';
export { RecallService } from './RecallService';
export { ConversationProcessor } from './ConversationProcessor';

// Service Types
export type {
  RecallQuery,
  RecallResult,
  RecallConfig,
  UnifiedMemoryResult,
  HybridSearchResult,
  VectorSearchResult as ServiceVectorSearchResult,
  TextSearchResult,
  ProceduralMatchResult,
  RelatedMemory,
  RecallMetrics
} from './RecallServiceTypes';

export type {
  ConversationMessage as ServiceConversationMessage,
  ExtractionConfig,
  ExtractionResult,
  ProcessingResult as ServiceProcessingResult
} from './ConversationProcessor';
