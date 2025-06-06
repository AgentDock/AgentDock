/**
 * @fileoverview Types for the messaging system used by nodes
 */

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high';

/**
 * Message structure for node communication
 */
export interface NodeMessage<T = unknown> {
  /** ID of the sending node */
  sourceId: string;
  /** ID of the target node */
  targetId: string;
  /** Message type identifier */
  type: string;
  /** Message payload */
  payload: T;
  /** Message priority */
  priority: MessagePriority;
  /** Current retry count */
  retryCount: number;
  /** Maximum number of retries */
  maxRetries: number;
}

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown> = (
  message: NodeMessage<T>
) => Promise<void>;

/**
 * Message bus interface for node communication
 */
export interface MessageBus {
  /** Send a message */
  send(message: NodeMessage): Promise<string>;
  /** Subscribe to message type */
  subscribe<T>(type: string, handler: MessageHandler<T>): void;
  /** Unsubscribe from message type */
  unsubscribe(type: string): void;
  /** Clear all subscriptions */
  clear(): void;
}
