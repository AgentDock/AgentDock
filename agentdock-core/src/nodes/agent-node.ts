/**
 * @fileoverview Core agent node implementation for the AgentDock framework.
 * This node manages the agent's lifecycle and message handling.
 */

import { BaseNode } from './base-node';
import { AgentConfig } from '../types/agent-config';
import { MessageBus, NodeMessage } from '../messaging/types';
import { NodeRegistry, ConcreteNodeConstructor } from './node-registry';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';

/**
 * Configuration for the agent node
 */
export interface AgentNodeConfig {
  /** Agent configuration */
  agentConfig: AgentConfig;
  /** Whether to auto-start the agent */
  autoStart?: boolean;
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Agent state enum
 */
export enum AgentState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
}

/**
 * Core agent node that manages agent lifecycle and message handling
 */
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  private state: AgentState = AgentState.CREATED;
  private nodes: Map<string, BaseNode> = new Map();
  private memory: Map<string, unknown> = new Map();

  /**
   * Get static node metadata
   */
  static getNodeMetadata() {
    return {
      category: 'core' as 'core' | 'custom',
      label: 'Agent',
      description: 'Core agent node that manages agent lifecycle and message handling',
      inputs: [{
        id: 'message',
        type: 'any',
        label: 'Input Message',
        required: true
      }],
      outputs: [{
        id: 'response',
        type: 'any',
        label: 'Agent Response'
      }],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: true
      }
    };
  }

  protected getCategory(): 'core' | 'custom' {
    return 'core';
  }

  protected getLabel(): string {
    return 'Agent';
  }

  protected getDescription(): string {
    return 'Core agent node that manages agent lifecycle and message handling';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): { core: boolean; pro: boolean; custom: boolean } {
    return {
      core: true,
      pro: true,
      custom: true
    };
  }

  protected getInputs() {
    return [
      {
        id: 'message',
        type: 'any',
        label: 'Input Message',
        required: true
      }
    ];
  }

  protected getOutputs() {
    return [
      {
        id: 'response',
        type: 'any',
        label: 'Agent Response'
      }
    ];
  }

  /**
   * Initialize the agent node
   */
  async initialize(): Promise<void> {
    try {
      this.state = AgentState.INITIALIZING;

      // Initialize nodes based on enabled nodes
      for (const nodeType of this.config.agentConfig.nodes) {
        await this.initializeNode(nodeType);
      }

      // Set initial state based on configuration
      this.state = this.config.autoStart ? AgentState.RUNNING : AgentState.READY;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Execute the agent node
   */
  async execute(input: unknown): Promise<unknown> {
    if (this.state !== AgentState.RUNNING) {
      throw new Error(`Agent must be in RUNNING state (current: ${this.state})`);
    }

    try {
      // Process input through enabled nodes
      let result = input;
      for (const nodeType of this.config.agentConfig.nodes) {
        const node = this.nodes.get(nodeType);
        if (node) {
          result = await this.executeWithRetry(node, result);
        }
      }

      return result;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Execute a node with retry logic
   */
  private async executeWithRetry(
    node: BaseNode,
    input: unknown,
    attempt: number = 1
  ): Promise<unknown> {
    try {
      return await node.execute(input);
    } catch (error) {
      if (attempt < (this.config.maxRetries || 3)) {
        await new Promise(resolve => 
          setTimeout(resolve, (this.config.retryDelay || 1000) * attempt)
        );
        return this.executeWithRetry(node, input, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Initialize a node
   */
  private async initializeNode(nodeType: string): Promise<void> {
    const nodeConfig = this.config.agentConfig.nodeConfigurations[nodeType];
    if (!nodeConfig) {
      throw new Error(`Missing configuration for node: ${nodeType}`);
    }

    const NodeClass = await this.loadNodeClass(nodeType);
    const node = new NodeClass(`${this.id}-${nodeType}`, nodeConfig);
    await node.initialize();
    this.nodes.set(nodeType, node);
  }

  /**
   * Load a node class dynamically
   */
  private async loadNodeClass(nodeType: string): Promise<ConcreteNodeConstructor> {
    try {
      // Check if the node type exists in the registry
      if (!NodeRegistry.has(nodeType)) {
        throw createError('node', `Node type not found: ${nodeType}`, ErrorCode.NODE_NOT_FOUND);
      }

      // Create a new instance using the registry
      const node = NodeRegistry.create(nodeType, `${this.id}-${nodeType}`, {});
      
      // Return the constructor of the created node
      return node.constructor as ConcreteNodeConstructor;
    } catch (error) {
      throw createError('node', 
        `Failed to load node class for node: ${nodeType}`,
        ErrorCode.NODE_INITIALIZATION,
        {
          nodeType,
          cause: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Get value from memory
   */
  protected getMemory<T>(key: string): T | undefined {
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Memory read operation',
      { key, hasValue: this.memory.has(key) }
    );
    return this.memory.get(key) as T;
  }

  /**
   * Set value in memory
   */
  protected setMemory(key: string, value: unknown): void {
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Memory write operation',
      { key }
    );
    this.memory.set(key, value);
  }

  /**
   * Clear memory
   */
  protected clearMemory(): void {
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Memory clear operation'
    );
    this.memory.clear();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Cleaning up memory',
      { memorySize: this.memory.size }
    );
    this.state = AgentState.STOPPED;
    await Promise.all(Array.from(this.nodes.values()).map(node => node.cleanup()));
    this.nodes.clear();
    this.memory.clear();
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Pause agent execution
   */
  async pause(): Promise<void> {
    if (this.state === AgentState.RUNNING) {
      this.state = AgentState.PAUSED;
    }
  }

  /**
   * Resume agent execution
   */
  async resume(): Promise<void> {
    if (this.state === AgentState.PAUSED) {
      this.state = AgentState.RUNNING;
    }
  }

  /**
   * Stop agent execution
   */
  async stop(): Promise<void> {
    if (this.state !== AgentState.STOPPED) {
      await this.cleanup();
    }
  }
} 