/**
 * @fileoverview Core node registration for AgentDock.
 * This file registers all core nodes with the NodeRegistry.
 */

import { NodeRegistry } from './node-registry';
import { AgentNode } from './agent-node';
import { AnthropicNode } from './llm/anthropic-node';
import { ChatNode } from './chat';
import { SerpNode } from './serp/serp-node';
import { serpNodeParametersSchema } from './serp/schema';
import { DeepResearchNode } from './deep-research/deep-research-node';
import { deepResearchNodeParametersSchema } from './deep-research/schema';

/**
 * Register all core nodes with the registry
 */
export function registerCoreNodes(): void {
  // Register core nodes
  NodeRegistry.register('core.agent', AgentNode, '1.0.0');
  NodeRegistry.register('llm.anthropic', AnthropicNode, '1.0.0');
  NodeRegistry.register('core.chat', ChatNode, '1.0.0');
  
  // Register SerpNode with parameters schema
  NodeRegistry.register('core.tool.serp', SerpNode, '1.0.0', {
    isTool: true,
    parameters: serpNodeParametersSchema,
    description: 'Search the web for information using the configured search provider'
  });
  
  // Register DeepResearchNode with parameters schema
  NodeRegistry.register('core.tool.deep-research', DeepResearchNode, '1.0.0', {
    isTool: true,
    parameters: deepResearchNodeParametersSchema,
    description: 'Perform deep research by combining search and LLM summarization'
  });
}

// Register nodes immediately
registerCoreNodes(); 
 