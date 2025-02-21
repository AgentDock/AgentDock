/**
 * @fileoverview Agent runtime system for managing node execution.
 * Provides the core execution engine for agents.
 */

import { BaseNode } from '../types/node';
import { BaseAgent, AgentState, AgentError } from '../types/agent';

/**
 * Node execution result
 */
interface NodeExecutionResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
}

/**
 * Node execution options
 */
interface ExecuteOptions {
  timeout?: number;
  retries?: number;
  backoff?: number;
}

/**
 * Agent runtime implementation
 */
export class AgentRuntime extends BaseAgent {
  /** Default execution options */
  private static readonly DEFAULT_OPTIONS: Required<ExecuteOptions> = {
    timeout: 30000,  // 30 seconds
    retries: 3,
    backoff: 1000    // 1 second
  };

  /** Currently executing nodes */
  private executing: Set<string>;
  /** Execution queue */
  private queue: Array<{
    node: BaseNode;
    input: unknown;
    options?: ExecuteOptions;
    resolve: (result: NodeExecutionResult) => void;
    reject: (error: Error) => void;
  }>;

  constructor(config: any) {
    super(config);
    this.executing = new Set();
    this.queue = [];
  }

  /**
   * Execute a node with the given input
   */
  async executeNode(
    nodeType: string,
    input: unknown,
    options?: ExecuteOptions
  ): Promise<NodeExecutionResult> {
    const node = this.nodes.get(nodeType);
    if (!node) {
      throw new AgentError(
        `Node type "${nodeType}" not found`,
        'NODE_NOT_FOUND',
        this.state
      );
    }

    if (this.state !== AgentState.RUNNING) {
      throw new AgentError(
        'Agent must be in RUNNING state to execute nodes',
        'INVALID_STATE',
        this.state
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        node,
        input,
        options,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  /**
   * Process the execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    // Fixed concurrency limit of 1 for core implementation
    if (this.executing.size >= 1) {
      return;
    }

    const { node, input, options, resolve, reject } = this.queue.shift()!;
    const execOptions = { ...AgentRuntime.DEFAULT_OPTIONS, ...options };

    try {
      this.executing.add(node.type);
      const result = await this.executeWithRetry(node, input, execOptions);
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.executing.delete(node.type);
      this.processQueue();
    }
  }

  /**
   * Execute a node with retry logic
   */
  private async executeWithRetry(
    node: BaseNode,
    input: unknown,
    options: Required<ExecuteOptions>,
    attempt: number = 1
  ): Promise<NodeExecutionResult> {
    const start = Date.now();

    try {
      // Validate input
      if (!node.validateInput(input)) {
        throw new Error('Invalid input for node');
      }

      // Create execution context
      const context = this.createContext();

      // Execute with timeout
      const output = await Promise.race([
        node.execute(input),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), options.timeout)
        )
      ]);

      // Validate output
      if (!node.validateOutput(output)) {
        throw new Error('Invalid output from node');
      }

      return {
        success: true,
        output,
        duration: Date.now() - start
      };
    } catch (error) {
      if (attempt < options.retries) {
        // Wait for backoff period
        await new Promise(resolve =>
          setTimeout(resolve, options.backoff * attempt)
        );
        // Retry with incremented attempt count
        return this.executeWithRetry(node, input, options, attempt + 1);
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start
      };
    }
  }

  /**
   * Lifecycle hook implementations
   */
  protected async onInitialize(): Promise<void> {
    // Initialize all registered nodes
    for (const node of this.nodes.values()) {
      if (!node.validateInput(null)) {
        throw new AgentError(
          `Node "${node.type}" failed initialization`,
          'NODE_INIT_ERROR',
          this.state
        );
      }
    }
  }

  protected async onStart(): Promise<void> {
    // Clear execution state
    this.executing.clear();
    this.queue = [];
  }

  protected async onPause(): Promise<void> {
    // Wait for current executions to complete
    if (this.executing.size > 0) {
      await new Promise(resolve =>
        setInterval(() => {
          if (this.executing.size === 0) resolve(undefined);
        }, 100)
      );
    }
  }

  protected async onResume(): Promise<void> {
    // Resume queue processing
    this.processQueue();
  }

  protected async onStop(): Promise<void> {
    // Clear all state
    this.executing.clear();
    this.queue = [];
  }
} 