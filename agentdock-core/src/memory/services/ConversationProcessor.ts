import { z } from 'zod';

import { CoreLLM } from '../../llm/core-llm';
import { createLLM } from '../../llm/create-llm';
import { LLMProvider } from '../../llm/types';
import { EpisodicMemory } from '../types/episodic/EpisodicMemory';
import { ProceduralMemory } from '../types/procedural/ProceduralMemory';
import { SemanticMemory } from '../types/semantic/SemanticMemory';
import { WorkingMemory } from '../types/working/WorkingMemory';

/**
 * Configurable conversation message for processing
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Configurable extraction patterns
 */
export interface ExtractionConfig {
  // Custom LLM instructions for extraction
  customInstructions?: {
    episodic?: string;
    semantic?: string;
    procedural?: string;
  };

  // Pattern-based extraction rules
  patterns?: {
    factPattern?: RegExp;
    questionPattern?: RegExp;
    actionPattern?: RegExp;
    definitionPattern?: RegExp;
  };

  // LLM provider configuration
  llmConfig?: {
    provider: LLMProvider;
    model: string;
    maxTokens: number;
    temperature: number;
    apiKey?: string;
    baseURL?: string;
  };

  // Extraction strategy preferences
  strategy?: {
    preferLLM: boolean;
    fallbackToPatterns: boolean;
    tokenOptimized: boolean;
    batchSize: number;
  };

  // Memory type filters
  memoryTypes?: {
    enableEpisodic: boolean;
    enableSemantic: boolean;
    enableProcedural: boolean;
    enableWorking: boolean;
  };

  // Quality thresholds
  thresholds?: {
    minConfidence: number;
    minImportance: number;
    minLength: number;
    maxLength: number;
  };
}

/**
 * Extraction result for a single memory type
 */
export interface ExtractionResult {
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  memories: Array<{
    content: string;
    importance: number;
    confidence: number;
    metadata: Record<string, any>;
    extractionMethod: 'llm' | 'pattern' | 'fallback';
  }>;
  tokensUsed: number;
  extractionTime: number;
  errors: string[];
}

/**
 * Complete processing result
 */
export interface ProcessingResult {
  sessionId: string;
  messageCount: number;
  extractionResults: ExtractionResult[];
  totalTokensUsed: number;
  totalProcessingTime: number;
  storedMemoryIds: {
    working: string[];
    episodic: string[];
    semantic: string[];
    procedural: string[];
  };
  errors: string[];
}

/**
 * Default best-practice extraction prompts
 */
// Zod schemas for memory extraction validation
const EpisodicMemorySchema = z.object({
  memories: z.array(
    z.object({
      content: z.string().min(1),
      importance: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional()
    })
  )
});

const SemanticMemorySchema = z.object({
  memories: z.array(
    z.object({
      content: z.string().min(1),
      category: z.string().optional(),
      importance: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      keywords: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional()
    })
  )
});

const ProceduralMemorySchema = z.object({
  memories: z.array(
    z.object({
      trigger: z.string(),
      action: z.string().min(1),
      context: z.record(z.any()).optional(),
      confidence: z.number().min(0).max(1),
      conditions: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional()
    })
  )
});

const DEFAULT_EXTRACTION_PROMPTS = {
  episodic: `Extract episodic memories from this conversation. Focus on:
- Specific events and experiences
- Temporal sequences ("when X happened")  
- User actions and outcomes
- Contextual situations`,

  semantic: `Extract semantic knowledge from this conversation. Focus on:
- Facts and definitions
- Explanations and concepts
- Relationships between ideas
- General principles`,

  procedural: `Extract procedural patterns from this conversation. Focus on:
- Successful action sequences
- Problem-solving approaches
- Learned behaviors
- If-then patterns`
};

/**
 * Token-optimized fallback patterns (ReDoS-safe)
 */
const FALLBACK_PATTERNS = {
  facts: /(?:is|are|was|were)\s+(.{10,100})/gi,
  definitions:
    /([A-Za-z0-9\s\-_]{1,50})\s+(?:means|refers to|is defined as)\s+([A-Za-z0-9\s\-_,.!?]{1,200})/gi,
  actions:
    /(?:I|user|you)\s+(did|tried|attempted|executed|ran)\s+(.{10,150})/gi,
  outcomes: /(?:resulted in|led to|caused|produced)\s+(.{10,100})/gi,
  questions: /\?[^?]*$/gm,
  temporal: /(?:when|after|before|during|while)\s+(.{10,100})/gi
};

/**
 * ConversationProcessor with configurable LLM-based extraction
 * Provides flexible, token-optimized memory extraction with best practice fallbacks
 */
export class ConversationProcessor {
  private config: Required<ExtractionConfig>;
  private llm: CoreLLM | null = null;

  constructor(
    private workingMemory: WorkingMemory,
    private episodicMemory: EpisodicMemory,
    private semanticMemory: SemanticMemory,
    private proceduralMemory: ProceduralMemory,
    config: ExtractionConfig = {}
  ) {
    this.config = this.mergeWithDefaults(config);

    // Initialize LLM if apiKey is provided
    if (this.config.llmConfig.apiKey) {
      try {
        this.llm = createLLM({
          provider: this.config.llmConfig.provider,
          model: this.config.llmConfig.model,
          apiKey: this.config.llmConfig.apiKey,
          maxTokens: this.config.llmConfig.maxTokens,
          temperature: this.config.llmConfig.temperature
        });
      } catch (error) {
        console.warn('Failed to initialize LLM:', error);
        this.llm = null;
      }
    }
  }

  /**
   * Process conversation and extract memories across all types
   */
  async processConversation(
    userId: string,
    agentId: string,
    sessionId: string,
    messages: ConversationMessage[]
  ): Promise<ProcessingResult> {
    // Validate input messages array
    if (!messages || messages.length === 0) {
      return {
        sessionId,
        messageCount: 0,
        extractionResults: [],
        totalTokensUsed: 0,
        totalProcessingTime: 0,
        storedMemoryIds: {
          working: [],
          episodic: [],
          semantic: [],
          procedural: []
        },
        errors: ['No messages provided for processing']
      };
    }

    const startTime = Date.now();
    const result: ProcessingResult = {
      sessionId,
      messageCount: messages.length,
      extractionResults: [],
      totalTokensUsed: 0,
      totalProcessingTime: 0,
      storedMemoryIds: {
        working: [],
        episodic: [],
        semantic: [],
        procedural: []
      },
      errors: []
    };

    try {
      // Update working memory with current context
      if (this.config.memoryTypes.enableWorking) {
        await this.updateWorkingMemory(
          userId,
          agentId,
          sessionId,
          messages,
          result
        );
      }

      // Extract episodic memories
      if (this.config.memoryTypes.enableEpisodic) {
        const episodicResult = await this.extractEpisodicMemories(
          agentId,
          sessionId,
          messages
        );
        result.extractionResults.push(episodicResult);
        result.totalTokensUsed += episodicResult.tokensUsed;

        // Store episodic memories
        for (const memory of episodicResult.memories) {
          try {
            // TEMPORAL FIX: Preserve conversation timestamps in episodic memories
            const messageTimestamps = messages.map((m) => m.timestamp);
            const conversationStartTime = Math.min(...messageTimestamps);
            const conversationEndTime = Math.max(...messageTimestamps);

            const id = await this.episodicMemory.store(
              userId,
              agentId,
              memory.content,
              {
                sessionId: sessionId,
                importance: memory.importance,
                metadata: {
                  ...memory.metadata,
                  // NEW: Preserve original conversation temporal context
                  conversationStartTime,
                  conversationEndTime,
                  originalConversationDate: new Date(
                    conversationStartTime
                  ).toISOString(),
                  messageTimestamps: messageTimestamps
                }
              }
            );
            result.storedMemoryIds.episodic.push(id);
          } catch (error) {
            result.errors.push(`Failed to store episodic memory: ${error}`);
          }
        }
      }

      // Extract semantic memories
      if (this.config.memoryTypes.enableSemantic) {
        const semanticResult = await this.extractSemanticMemories(
          agentId,
          messages
        );
        result.extractionResults.push(semanticResult);
        result.totalTokensUsed += semanticResult.tokensUsed;

        // Store semantic memories
        for (const memory of semanticResult.memories) {
          try {
            const id = await this.semanticMemory.store(
              userId,
              agentId,
              memory.content,
              {
                category: memory.metadata.category || 'general',
                importance: memory.importance,
                confidence: memory.confidence,
                keywords: memory.metadata.keywords || [],
                metadata: memory.metadata
              }
            );
            result.storedMemoryIds.semantic.push(id);
          } catch (error) {
            result.errors.push(`Failed to store semantic memory: ${error}`);
          }
        }
      }

      // Extract procedural memories
      if (this.config.memoryTypes.enableProcedural) {
        const proceduralResult = await this.extractProceduralMemories(
          agentId,
          messages
        );
        result.extractionResults.push(proceduralResult);
        result.totalTokensUsed += proceduralResult.tokensUsed;

        // Store procedural memories
        for (const memory of proceduralResult.memories) {
          try {
            const trigger = memory.metadata.trigger || '';
            const action = memory.content;

            const learningResult = await this.proceduralMemory.learn(
              userId,
              agentId,
              trigger,
              action
            );
            result.storedMemoryIds.procedural.push(learningResult.patternId);
          } catch (error) {
            result.errors.push(`Failed to store procedural memory: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Processing error: ${error}`);
    }

    result.totalProcessingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract episodic memories using configurable LLM or patterns
   */
  private async extractEpisodicMemories(
    agentId: string,
    sessionId: string,
    messages: ConversationMessage[]
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const result: ExtractionResult = {
      type: 'episodic',
      memories: [],
      tokensUsed: 0,
      extractionTime: 0,
      errors: []
    };

    try {
      if (this.config.strategy.preferLLM && this.config.llmConfig) {
        // Use LLM extraction
        const llmResult = await this.extractWithLLM(
          messages,
          this.config.customInstructions?.episodic ||
            DEFAULT_EXTRACTION_PROMPTS.episodic,
          'episodic'
        );

        if (llmResult.success) {
          result.memories = llmResult.memories.map((m) => ({
            ...m,
            extractionMethod: 'llm' as const
          }));
          result.tokensUsed = llmResult.tokensUsed;
        } else if (this.config.strategy.fallbackToPatterns) {
          // Fallback to patterns
          result.memories = this.extractEpisodicWithPatterns(messages);
          result.memories.forEach((m) => (m.extractionMethod = 'fallback'));
        }
      } else {
        // Use pattern-based extraction
        result.memories = this.extractEpisodicWithPatterns(messages);
        result.memories.forEach((m) => (m.extractionMethod = 'pattern'));
      }
    } catch (error) {
      result.errors.push(`Episodic extraction error: ${error}`);
    }

    result.extractionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract semantic memories using configurable LLM or patterns
   */
  private async extractSemanticMemories(
    agentId: string,
    messages: ConversationMessage[]
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const result: ExtractionResult = {
      type: 'semantic',
      memories: [],
      tokensUsed: 0,
      extractionTime: 0,
      errors: []
    };

    try {
      if (this.config.strategy.preferLLM && this.config.llmConfig) {
        const llmResult = await this.extractWithLLM(
          messages,
          this.config.customInstructions?.semantic ||
            DEFAULT_EXTRACTION_PROMPTS.semantic,
          'semantic'
        );

        if (llmResult.success) {
          result.memories = llmResult.memories.map((m) => ({
            ...m,
            extractionMethod: 'llm' as const
          }));
          result.tokensUsed = llmResult.tokensUsed;
        } else if (this.config.strategy.fallbackToPatterns) {
          result.memories = this.extractSemanticWithPatterns(messages);
          result.memories.forEach((m) => (m.extractionMethod = 'fallback'));
        }
      } else {
        result.memories = this.extractSemanticWithPatterns(messages);
        result.memories.forEach((m) => (m.extractionMethod = 'pattern'));
      }
    } catch (error) {
      result.errors.push(`Semantic extraction error: ${error}`);
    }

    result.extractionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract procedural memories using configurable LLM or patterns
   */
  private async extractProceduralMemories(
    agentId: string,
    messages: ConversationMessage[]
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const result: ExtractionResult = {
      type: 'procedural',
      memories: [],
      tokensUsed: 0,
      extractionTime: 0,
      errors: []
    };

    try {
      if (this.config.strategy.preferLLM && this.config.llmConfig) {
        const llmResult = await this.extractWithLLM(
          messages,
          this.config.customInstructions?.procedural ||
            DEFAULT_EXTRACTION_PROMPTS.procedural,
          'procedural'
        );

        if (llmResult.success) {
          result.memories = llmResult.memories.map((m) => ({
            ...m,
            extractionMethod: 'llm' as const
          }));
          result.tokensUsed = llmResult.tokensUsed;
        } else if (this.config.strategy.fallbackToPatterns) {
          result.memories = this.extractProceduralWithPatterns(messages);
          result.memories.forEach((m) => (m.extractionMethod = 'fallback'));
        }
      } else {
        result.memories = this.extractProceduralWithPatterns(messages);
        result.memories.forEach((m) => (m.extractionMethod = 'pattern'));
      }
    } catch (error) {
      result.errors.push(`Procedural extraction error: ${error}`);
    }

    result.extractionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract memories using REAL LLM with Zod validation
   */
  private async extractWithLLM(
    messages: ConversationMessage[],
    instructions: string,
    memoryType: 'episodic' | 'semantic' | 'procedural' = 'semantic'
  ): Promise<{
    success: boolean;
    memories: Array<{
      content: string;
      importance: number;
      confidence: number;
      metadata: Record<string, any>;
    }>;
    tokensUsed: number;
  }> {
    if (!this.llm) {
      return { success: false, memories: [], tokensUsed: 0 };
    }

    const conversationText = this.optimizeConversationForLLM(messages);
    const schema = this.getSchemaForMemoryType(memoryType);

    try {
      console.log(
        `🧠 Using generateObject for ${memoryType} extraction with Zod schema`
      );
      const { object: result, usage } = await this.llm.generateObject({
        schema,
        messages: [
          {
            role: 'user',
            content: `${instructions}

Conversation:
${conversationText}

Extract memories according to the schema provided.`
          }
        ],
        temperature: this.config.llmConfig.temperature
      });

      console.log(
        `✅ generateObject returned:`,
        JSON.stringify(result, null, 2)
      );

      const memories = result.memories.map((memory: any) => {
        // Handle different memory type schemas
        const baseMemory = {
          content: memory.content || (memory as any).action || '',
          importance: memory.importance || (memory as any).confidence || 0.5,
          confidence: memory.confidence || 0.7,
          metadata: {
            ...memory.metadata,
            extractionMethod: 'llm_zod'
          }
        };

        // Add type-specific metadata
        if (memoryType === 'semantic') {
          baseMemory.metadata.category = (memory as any).category;
          baseMemory.metadata.keywords = (memory as any).keywords;
        } else if (memoryType === 'episodic') {
          baseMemory.metadata.tags = (memory as any).tags;
        } else if (memoryType === 'procedural') {
          baseMemory.metadata.trigger = (memory as any).trigger;
          baseMemory.metadata.conditions = (memory as any).conditions;
          // For procedural, use action as content if content is empty
          if (!baseMemory.content && (memory as any).action) {
            baseMemory.content = (memory as any).action;
          }
        }

        return baseMemory;
      });

      return {
        success: true,
        memories: memories.filter(
          (m: { content: string; importance: number }) =>
            m.content.length >= this.config.thresholds.minLength &&
            m.importance >= this.config.thresholds.minImportance
        ),
        tokensUsed: usage?.totalTokens || 0
      };
    } catch (error) {
      console.error('❌ LLM extraction with Zod failed:', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
      }
      console.log('🔄 Falling back to patterns...');
      return { success: false, memories: [], tokensUsed: 0 };
    }
  }

  /**
   * Get appropriate Zod schema for memory type
   */
  private getSchemaForMemoryType(
    memoryType: 'episodic' | 'semantic' | 'procedural'
  ) {
    switch (memoryType) {
      case 'episodic':
        return EpisodicMemorySchema;
      case 'semantic':
        return SemanticMemorySchema;
      case 'procedural':
        return ProceduralMemorySchema;
      default:
        return SemanticMemorySchema;
    }
  }

  /**
   * Fallback pattern-based extraction methods
   */
  private extractEpisodicWithPatterns(messages: ConversationMessage[]): Array<{
    content: string;
    importance: number;
    confidence: number;
    metadata: Record<string, any>;
    extractionMethod: 'pattern';
  }> {
    const memories: any[] = [];
    const fullText = messages.map((m) => m.content).join(' ');

    // Extract temporal events
    const temporalMatches = Array.from(
      fullText.matchAll(FALLBACK_PATTERNS.temporal)
    );
    for (const match of temporalMatches) {
      if (match[1] && match[1].length >= this.config.thresholds.minLength) {
        memories.push({
          content: match[1].trim(),
          importance: 0.6,
          confidence: 0.5,
          metadata: { type: 'temporal_event', pattern: 'temporal' },
          extractionMethod: 'pattern'
        });
      }
    }

    // Extract action sequences
    const actionMatches = Array.from(
      fullText.matchAll(FALLBACK_PATTERNS.actions)
    );
    for (const match of actionMatches) {
      if (match[2] && match[2].length >= this.config.thresholds.minLength) {
        memories.push({
          content: `${match[1]} ${match[2]}`.trim(),
          importance: 0.5,
          confidence: 0.4,
          metadata: { type: 'action_sequence', pattern: 'action' },
          extractionMethod: 'pattern'
        });
      }
    }

    return memories.slice(0, 10); // Limit results
  }

  private extractSemanticWithPatterns(messages: ConversationMessage[]): Array<{
    content: string;
    importance: number;
    confidence: number;
    metadata: Record<string, any>;
    extractionMethod: 'pattern';
  }> {
    const memories: any[] = [];
    const fullText = messages.map((m) => m.content).join(' ');

    // Extract facts
    const factMatches = Array.from(fullText.matchAll(FALLBACK_PATTERNS.facts));
    for (const match of factMatches) {
      if (match[1] && match[1].length >= this.config.thresholds.minLength) {
        memories.push({
          content: match[0].trim(),
          importance: 0.7,
          confidence: 0.6,
          metadata: { category: 'fact', pattern: 'fact', keywords: [] },
          extractionMethod: 'pattern'
        });
      }
    }

    // Extract definitions
    const defMatches = Array.from(
      fullText.matchAll(FALLBACK_PATTERNS.definitions)
    );
    for (const match of defMatches) {
      if (match[1] && match[2]) {
        memories.push({
          content: `${match[1]} means ${match[2]}`.trim(),
          importance: 0.8,
          confidence: 0.7,
          metadata: {
            category: 'definition',
            pattern: 'definition',
            keywords: [match[1].trim()]
          },
          extractionMethod: 'pattern'
        });
      }
    }

    return memories.slice(0, 10);
  }

  private extractProceduralWithPatterns(
    messages: ConversationMessage[]
  ): Array<{
    content: string;
    importance: number;
    confidence: number;
    metadata: Record<string, any>;
    extractionMethod: 'pattern';
  }> {
    const memories: any[] = [];
    const fullText = messages.map((m) => m.content).join(' ');

    // Extract outcome patterns
    const outcomeMatches = Array.from(
      fullText.matchAll(FALLBACK_PATTERNS.outcomes)
    );
    for (const match of outcomeMatches) {
      if (match[1] && match[1].length >= this.config.thresholds.minLength) {
        memories.push({
          content: match[1].trim(),
          importance: 0.6,
          confidence: 0.5,
          metadata: {
            trigger: 'pattern_detected',
            action: match[1].trim(),
            pattern: 'outcome',
            conditions: []
          },
          extractionMethod: 'pattern'
        });
      }
    }

    return memories.slice(0, 5);
  }

  /**
   * Update working memory with current conversation context
   */
  private async updateWorkingMemory(
    userId: string,
    agentId: string,
    sessionId: string,
    messages: ConversationMessage[],
    result: ProcessingResult
  ): Promise<void> {
    try {
      const recentMessages = messages.slice(-5); // Last 5 messages
      const contextContent = recentMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      // TEMPORAL FIX: Preserve original conversation timestamps
      const messageTimestamps = recentMessages.map((m) => m.timestamp);
      const conversationStartTime = Math.min(...messageTimestamps);
      const conversationEndTime = Math.max(...messageTimestamps);

      const id = await this.workingMemory.store(
        userId,
        agentId,
        contextContent,
        {
          sessionId: sessionId,
          metadata: {
            priority: 'high',
            messageCount: recentMessages.length,
            lastMessageTime: conversationEndTime,
            // NEW: Preserve original conversation temporal context
            conversationStartTime,
            conversationEndTime,
            originalConversationDate: new Date(
              conversationStartTime
            ).toISOString(),
            messageTimestamps: messageTimestamps
          }
        }
      );

      result.storedMemoryIds.working.push(id);
    } catch (error) {
      result.errors.push(`Failed to update working memory: ${error}`);
    }
  }

  /**
   * Optimize conversation text for LLM processing
   */
  private optimizeConversationForLLM(messages: ConversationMessage[]): string {
    if (!this.config.strategy.tokenOptimized) {
      return messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    }

    // Token optimization strategies
    let optimizedMessages = messages;

    // Batch processing for large conversations
    if (messages.length > this.config.strategy.batchSize) {
      optimizedMessages = messages.slice(-this.config.strategy.batchSize);
    }

    // Remove excessive whitespace and format efficiently
    return optimizedMessages
      .map((m) => `${m.role}: ${m.content.trim().replace(/\s+/g, ' ')}`)
      .join('\n')
      .substring(
        0,
        this.config.llmConfig?.maxTokens
          ? this.config.llmConfig.maxTokens * 3
          : 3000
      );
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(
    config: ExtractionConfig
  ): Required<ExtractionConfig> {
    return {
      customInstructions: config.customInstructions || {},
      patterns: { ...FALLBACK_PATTERNS, ...config.patterns },
      llmConfig: {
        provider: 'openai' as LLMProvider,
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.1,
        ...config.llmConfig
      },
      strategy: {
        preferLLM: false,
        fallbackToPatterns: true,
        tokenOptimized: true,
        batchSize: 20,
        ...config.strategy
      },
      memoryTypes: {
        enableEpisodic: true,
        enableSemantic: true,
        enableProcedural: true,
        enableWorking: true,
        ...config.memoryTypes
      },
      thresholds: {
        minConfidence: 0.3,
        minImportance: 0.3,
        minLength: 10,
        maxLength: 1000,
        ...config.thresholds
      }
    };
  }
}
