/**
 * @fileoverview Node registry system for managing core and custom nodes.
 * Provides a central registry for node types and their metadata.
 */

import { Tool } from 'ai';
import { z } from 'zod';

import { createError, ErrorCode } from '../errors';
import { BaseNode, NodeMetadata } from './base-node';
import { ToolRegistrationOptions } from './tool';

/**
 * Type for concrete node class constructor
 */
export type ConcreteNodeConstructor = {
  new (id: string, config: any): BaseNode;
  getNodeMetadata(): NodeMetadata;
};

/**
 * Versioned node information with tool support
 */
interface NodeRegistration {
  /** Node class constructor */
  nodeClass: ConcreteNodeConstructor;
  /** Node version */
  version: string;
  /** Whether this node can act as a tool */
  isTool?: boolean;
  /** Tool parameters schema (if isTool is true) */
  parameters?: z.ZodSchema;
  /** Tool description (if isTool is true) */
  description?: string;
}

/**
 * Metadata for the node registry, including both core and custom nodes
 */
export interface NodeRegistryMetadata {
  /** Core nodes registered in the system */
  nodes: Array<{
    type: string;
    metadata: NodeMetadata;
    version: string;
    isTool?: boolean;
  }>;
  /** Custom nodes registered in the system */
  customNodes: Array<{
    type: string;
    metadata: NodeMetadata;
    version: string;
    isTool?: boolean;
  }>;
}

/**
 * Central registry for managing node types in the system.
 * Handles both core and custom nodes with proper validation.
 */
export class NodeRegistry {
  /** Map of registered core nodes */
  private static nodes: Map<string, NodeRegistration> = new Map();

  /** Map of registered custom nodes */
  private static customNodes: Map<string, NodeRegistration> = new Map();

  /**
   * Validate node registration
   */
  private static validateRegistration(
    nodeType: string,
    nodeClass: ConcreteNodeConstructor,
    expectedCategory: 'core' | 'custom',
    options: ToolRegistrationOptions = {}
  ): void {
    const metadata = nodeClass.getNodeMetadata();

    // Validate node category
    if (metadata.category !== expectedCategory) {
      throw createError(
        'node',
        `Only ${expectedCategory} nodes can be registered with ${expectedCategory === 'core' ? 'register' : 'registerCustomNode'}()`,
        ErrorCode.NODE_VALIDATION
      );
    }

    // Validate tool requirements if isTool is true
    if (options.isTool) {
      if (!options.parameters) {
        throw createError(
          'node',
          'Tool nodes must provide parameters schema',
          ErrorCode.NODE_VALIDATION
        );
      }

      // Validate that the node class has an execute method
      const prototype = nodeClass.prototype;
      if (typeof prototype.execute !== 'function') {
        throw createError(
          'node',
          'Tool nodes must implement execute method',
          ErrorCode.NODE_VALIDATION
        );
      }
    }
  }

  /**
   * Common logic for registering a node type.
   */
  private static registerNode(
    nodeType: string,
    nodeClass: ConcreteNodeConstructor,
    version: string,
    expectedCategory: 'core' | 'custom',
    options: ToolRegistrationOptions = {}
  ): void {
    this.validateRegistration(nodeType, nodeClass, expectedCategory, options);
    const targetMap =
      expectedCategory === 'core' ? this.nodes : this.customNodes;
    targetMap.set(nodeType, {
      nodeClass,
      version,
      isTool: options.isTool,
      parameters: options.parameters,
      description:
        options.description || nodeClass.getNodeMetadata().description
    });
  }

  /**
   * Register a core node type.
   */
  static register(
    nodeType: string,
    nodeClass: ConcreteNodeConstructor,
    version: string,
    options: ToolRegistrationOptions = {}
  ): void {
    this.registerNode(nodeType, nodeClass, version, 'core', options);
  }

  /**
   * Register a custom node type.
   */
  static registerCustomNode(
    nodeType: string,
    nodeClass: ConcreteNodeConstructor,
    version: string,
    options: ToolRegistrationOptions = {}
  ): void {
    this.registerNode(nodeType, nodeClass, version, 'custom', options);
  }

  /**
   * Get tool definitions for all registered tool nodes
   */
  static getToolDefinitions(): Record<string, Tool> {
    const tools: Record<string, Tool> = {};

    // Helper to process nodes
    const processNodes = (nodes: Map<string, NodeRegistration>) => {
      for (const [type, registration] of nodes.entries()) {
        if (registration.isTool) {
          tools[type] = {
            description: registration.description!,
            parameters: registration.parameters!,
            execute: async (input: unknown) => {
              // Create a fresh instance for each execution
              const nodeInstance = new registration.nodeClass(
                `${type}-${Date.now()}`, // Unique ID for this execution
                {} // Empty config - tools should be self-contained
              );

              try {
                // Execute and return result
                return await nodeInstance.execute(input);
              } finally {
                // Ensure cleanup is called
                await nodeInstance.cleanup();
              }
            }
          };
        }
      }
    };

    // Process both core and custom nodes
    processNodes(this.nodes);
    processNodes(this.customNodes);

    return tools;
  }

  /**
   * Create a node instance with version compatibility check
   */
  static create(nodeType: string, id: string, config: any): BaseNode {
    const nodeInfo = this.nodes.get(nodeType) || this.customNodes.get(nodeType);
    if (!nodeInfo) {
      throw createError(
        'node',
        `Unknown node type: ${nodeType}`,
        ErrorCode.NODE_NOT_FOUND
      );
    }

    // Version compatibility check
    const metadata = nodeInfo.nodeClass.getNodeMetadata();
    if (!this.isVersionCompatible(nodeInfo.version, metadata.version)) {
      throw createError(
        'node',
        `Version mismatch: Node requires ${nodeInfo.version}, but ${metadata.version} was provided`,
        ErrorCode.NODE_VALIDATION
      );
    }

    return new nodeInfo.nodeClass(id, config);
  }

  /**
   * Get metadata for all registered nodes
   */
  static getNodeMetadata(): NodeRegistryMetadata {
    return {
      nodes: Array.from(this.nodes.entries()).map(([type, info]) => ({
        type,
        metadata: info.nodeClass.getNodeMetadata(),
        version: info.version,
        isTool: info.isTool
      })),
      customNodes: Array.from(this.customNodes.entries()).map(
        ([type, info]) => ({
          type,
          metadata: info.nodeClass.getNodeMetadata(),
          version: info.version,
          isTool: info.isTool
        })
      )
    };
  }

  /**
   * Check if a node type exists
   */
  static has(nodeType: string): boolean {
    return this.nodes.has(nodeType) || this.customNodes.has(nodeType);
  }

  /**
   * Get version for a node type
   */
  static getVersion(nodeType: string): string | undefined {
    return (
      this.nodes.get(nodeType)?.version ||
      this.customNodes.get(nodeType)?.version
    );
  }

  /**
   * Version compatibility check
   */
  private static isVersionCompatible(
    required: string,
    provided: string
  ): boolean {
    // Major version must match exactly
    // Minor and patch can be greater or equal
    const requiredParts = required.split('.');
    const providedParts = provided.split('.');

    // Major version must match
    if (requiredParts[0] !== providedParts[0]) {
      return false;
    }

    // Minor version must be greater or equal
    if (parseInt(providedParts[1]) < parseInt(requiredParts[1])) {
      return false;
    }

    // If minor versions match, patch must be greater or equal
    if (
      parseInt(providedParts[1]) === parseInt(requiredParts[1]) &&
      parseInt(providedParts[2]) < parseInt(requiredParts[2])
    ) {
      return false;
    }

    return true;
  }

  /**
   * Clear registry (mainly for testing)
   */
  static clear(): void {
    this.nodes.clear();
    this.customNodes.clear();
  }
}
