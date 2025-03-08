/**
 * @fileoverview Clean node system exports for AgentDock Core
 * Provides the core node system types and classes for AgentDock.
 */

// Core node types
export type { 
  NodeMetadata,
  NodePort,
  BaseNodeConstructor
} from './base-node';

// Base node implementation
export { BaseNode } from './base-node';

// Node registry
export { NodeRegistry } from './node-registry';
export type { NodeRegistryMetadata } from './node-registry';

// Tool system
export type { 
  ToolRegistrationOptions,
  Tool,
  ToolResult 
} from './tool';

// Core nodes
export { AgentNode } from './agent-node';
export type { AgentNodeConfig, AgentNodeOptions } from './agent-node';

// Tool registry
export { 
  getToolRegistry, 
  setToolRegistry, 
  DefaultToolRegistry 
} from './tool-registry';
export type { ToolRegistry } from './tool-registry'; 