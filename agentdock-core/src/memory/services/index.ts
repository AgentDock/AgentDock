/**
 * @fileoverview Memory Services - Core processing and orchestration services
 *
 * Provides high-level services for memory processing, recall, and conversation handling.
 */

// Core Services
export { EncryptionService } from './EncryptionService';
export { RecallService } from './RecallService';
// ConversationProcessor removed in favor of PRIME extraction system

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

// ConversationProcessor types removed with the service
// Use PRIMEExtractor and PRIMEOrchestrator types instead
