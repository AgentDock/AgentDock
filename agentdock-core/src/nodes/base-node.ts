/**
 * @fileoverview Core node base class for the AgentDock framework.
 * This is the foundation of the node-based architecture.
 */

import { MessageBus, MessageHandler, NodeMessage } from '../messaging/types';
import { NodeCategory } from '../types/node-category';

/**
 * Node metadata containing immutable information about a node.
 */
export interface NodeMetadata {
  /** Category of the node (core or custom) */
  readonly category: NodeCategory;
  /** Display name of the node */
  readonly label: string;
  /** Description of the node's purpose and functionality */
  readonly description: string;
  /** Input ports defining what data the node accepts */
  readonly inputs: readonly NodePort[];
  /** Output ports defining what data the node produces */
  readonly outputs: readonly NodePort[];
  /** Version information */
  readonly version: string;
  /** Compatibility information */
  readonly compatibility: {
    core: boolean; // Works with Core
    pro: boolean; // Works with Pro
    custom: boolean; // Available for custom implementations
  };
}

/**
 * Port definition for node inputs and outputs.
 */
export interface NodePort {
  /** Unique identifier for the port */
  readonly id: string;
  /** Data type that the port accepts/produces */
  readonly type: string;
  /** Display name of the port */
  readonly label: string;
  /** Optional schema for validating data */
  readonly schema?: unknown;
  /** Whether this port is required */
  readonly required?: boolean;
  /** Default value for the port */
  readonly defaultValue?: unknown;
}

/**
 * Base node class that all nodes must extend.
 * Provides core functionality and type safety.
 */
export abstract class BaseNode<TConfig = unknown> {
  /** Unique identifier for the node */
  readonly id: string;

  /** Unique type identifier for the node */
  abstract readonly type: string;

  /** Node configuration (immutable after construction) */
  protected config: TConfig;

  /** Node metadata (immutable after construction) */
  readonly metadata: NodeMetadata;

  /** Message bus for node communication */
  private messageBus?: MessageBus;

  /** Message handlers */
  private handlers: Map<string, MessageHandler> = new Map();

  constructor(id: string, config: TConfig) {
    this.id = id;
    this.config = config;
    this.metadata = Object.freeze(this.getMetadata());
  }

  /**
   * Static method to get node metadata.
   * This is used by the NodeRegistry for type information.
   */
  static getNodeMetadata(): NodeMetadata {
    return {
      category: this.prototype.getCategory(),
      label: this.prototype.getLabel(),
      description: this.prototype.getDescription(),
      inputs: this.prototype.getInputs(),
      outputs: this.prototype.getOutputs(),
      version: this.prototype.getVersion(),
      compatibility: this.prototype.getCompatibility()
    };
  }

  /**
   * Set message bus for node communication
   */
  setMessageBus(messageBus: MessageBus): void {
    this.messageBus = messageBus;
    this.registerMessageHandlers();
  }

  /**
   * Send a message to another node
   */
  protected async sendMessage<T>(
    targetId: string,
    type: string,
    payload: T,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<string> {
    if (!this.messageBus) {
      throw new Error('Message bus not initialized');
    }

    return this.messageBus.send({
      sourceId: this.id,
      targetId,
      type,
      payload,
      priority,
      retryCount: 0,
      maxRetries: 3
    });
  }

  /**
   * Register message handlers for this node
   */
  protected registerMessageHandlers(): void {
    if (!this.messageBus) return;

    // Convert Map entries to array for iteration
    Array.from(this.handlers.entries()).forEach(([type, handler]) => {
      this.messageBus?.subscribe(type, handler);
    });
  }

  /**
   * Add a message handler
   */
  protected addMessageHandler<T>(
    type: string,
    handler: MessageHandler<T>
  ): void {
    this.handlers.set(type, handler as MessageHandler);
    if (this.messageBus) {
      this.messageBus.subscribe(type, handler);
    }
  }

  /**
   * Remove a message handler
   */
  protected removeMessageHandler(type: string): void {
    this.handlers.delete(type);
    this.messageBus?.unsubscribe(type);
  }

  /**
   * Get the complete metadata for this node.
   */
  protected getMetadata(): NodeMetadata {
    return {
      category: this.getCategory(),
      label: this.getLabel(),
      description: this.getDescription(),
      inputs: Object.freeze(this.getInputs()),
      outputs: Object.freeze(this.getOutputs()),
      version: this.getVersion(),
      compatibility: this.getCompatibility()
    };
  }

  /** Get the node category (core or custom) */
  protected abstract getCategory(): NodeCategory;

  /** Get the display name of the node */
  protected abstract getLabel(): string;

  /** Get the node description */
  protected abstract getDescription(): string;

  /** Get the node version */
  protected abstract getVersion(): string;

  /** Get compatibility information */
  protected abstract getCompatibility(): NodeMetadata['compatibility'];

  /** Define the node's input ports */
  protected abstract getInputs(): readonly NodePort[];

  /** Define the node's output ports */
  protected abstract getOutputs(): readonly NodePort[];

  /** Execute the node's functionality */
  abstract execute(input: unknown): Promise<unknown>;

  /** Initialize the node (called before first execution) */
  async initialize(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
  }

  /** Clean up node resources */
  async cleanup(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
  }

  /** Validate input data */
  validateInput(input: unknown): boolean {
    return true; // Override for specific validation
  }

  /** Validate output data */
  validateOutput(output: unknown): boolean {
    return true; // Override for specific validation
  }

  /**
   * Validate that a connection between two ports is valid
   * @param sourcePort Source port ID
   * @param targetPort Target port ID
   * @returns Whether the connection is valid
   */
  validateConnection(sourcePort: string, targetPort: string): boolean {
    // Default implementation allows all connections
    // Subclasses can override this to implement custom validation
    return true;
  }

  /** Serialize node for storage/transmission */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      config: this.config,
      metadata: this.metadata
    };
  }
}

/**
 * Type definition for the BaseNode constructor including static methods.
 */
export interface BaseNodeConstructor {
  new (id: string, config: any): BaseNode;
  getNodeMetadata(): NodeMetadata;
}
