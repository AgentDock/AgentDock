/**
 * @fileoverview Clean node system exports for AgentDock Core
 * Provides the core node system types and classes for AgentDock.
 */

// Core node types
export type { NodeMetadata, NodePort, BaseNodeConstructor } from './base-node';

// Base node implementation
export { BaseNode } from './base-node';

// Node registry
export { NodeRegistry } from './node-registry';
export type { NodeRegistryMetadata } from './node-registry';

// Tool system
export type { ToolRegistrationOptions, Tool, ToolResult } from './tool';

// Core nodes
export { AgentNode } from './agent-node';
export type { AgentNodeConfig, AgentNodeHandleMessageOptions } from './agent-node';

// Tool registry
export { getToolRegistry, setToolRegistry, DefaultToolRegistry } from './tool-registry';
export type { ToolRegistry } from './tool-registry';

// Register utilities
export { registerCoreNodes } from './register-core-nodes';
export { getToolRegistry as registerTool } from './tool-registry';
export type { ToolRegistrationOptions as ToolMetadata } from './tool';
export type { Tool as ToolExecutionFunction } from './tool';
