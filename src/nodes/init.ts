/**
 * @fileoverview Handles initialization for custom tools.
 * Serves as the single entry point for all tool registration in the system.
 *
 * In AgentDock, tools are a specialized type of node that can be used by AI agents.
 * This file initializes the registry for these custom tools.
 */

import {
  getToolRegistry,
  LogCategory,
  logger,
  ToolRegistry
} from 'agentdock-core';

// Import the registry file that registers all the tools
import { allTools, getToolsForAgent } from './registry';

// Global flag to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __toolRegistryInitialized: boolean;
}

/**
 * Validate tool structure
 * Ensures tools have required properties before registration
 */
function validateTool(name: string, tool: any): boolean {
  if (!tool) {
    logger.error(
      LogCategory.NODE,
      '[NodeRegistry]',
      `Tool ${name} is undefined or null`
    );
    return false;
  }

  // Check for required properties
  const requiredProps = ['description', 'parameters', 'execute'];
  const missingProps = requiredProps.filter((prop) => !(prop in tool));

  if (missingProps.length > 0) {
    logger.error(
      LogCategory.NODE,
      '[NodeRegistry]',
      `Tool ${name} is missing required properties: ${missingProps.join(', ')}`
    );
    return false;
  }

  // Ensure tool.name matches the registry key
  if (!tool.name || tool.name !== name) {
    logger.warn(
      LogCategory.NODE,
      '[NodeRegistry]',
      `Tool name mismatch: registry key is "${name}" but tool.name is "${tool.name || 'undefined'}"`
    );

    // Important: Force the name to match the registry key
    logger.info(
      LogCategory.NODE,
      '[NodeRegistry]',
      `Setting tool.name to "${name}" to match registry key`
    );
    tool.name = name;
  }

  // Enhanced validation: Log whether tool's execution function directly accesses LLM context
  // This is just informational and doesn't affect validation result
  if (typeof tool.execute === 'function') {
    const fnStr = tool.execute.toString();
    const usesLLMContext =
      fnStr.includes('llmContext') || fnStr.includes('LLMContext');
    const requiresLLM =
      fnStr.includes('llmContext?.llm') ||
      fnStr.includes('!options.llmContext?.llm');

    logger.debug(
      LogCategory.NODE,
      '[NodeRegistry]',
      `Tool ${name} LLM usage analysis:`,
      {
        usesLLMContext,
        requiresLLM,
        hasFallback: usesLLMContext && !requiresLLM
      }
    );
  }

  return true;
}

/**
 * Initialize the tool registry with custom tools
 * This is called once at system startup
 */
export function initToolRegistry() {
  // Prevent multiple initializations
  if (global.__toolRegistryInitialized) {
    logger.debug(
      LogCategory.NODE,
      '[NodeRegistry]',
      'Tool registry already initialized, skipping'
    );
    return;
  }

  try {
    logger.debug(
      LogCategory.NODE,
      '[NodeRegistry]',
      'Initializing tool registry...'
    );

    // Get the core tool registry
    const registry = getToolRegistry();

    // For each tool in allTools, register it with the core registry
    Object.entries(allTools).forEach(([name, tool]) => {
      // Validate tool before registration
      if (!validateTool(name, tool)) {
        logger.warn(
          LogCategory.NODE,
          '[NodeRegistry]',
          `Skipping registration of invalid tool: ${name}`
        );
        return;
      }

      // Register the tool with the core registry
      registry.registerTool(name, tool);

      // Removed redundant log - summary log is added after the loop
      /*
      logger.debug(
        LogCategory.NODE, 
        '[NodeRegistry]', 
        `Registered tool ${name} with core registry`,
        {
          toolName: tool.name,
          hasExecute: typeof tool.execute === 'function'
        }
      );
      */
    });

    // Mark as initialized globally
    global.__toolRegistryInitialized = true;

    // Verify registration by retrieving tools
    const registeredTools = registry.getToolsForAgent(Object.keys(allTools));

    // Log completion
    logger.info(
      LogCategory.NODE,
      '[NodeRegistry]',
      'Tool registry initialization complete',
      {
        toolCount: Object.keys(allTools).length,
        registeredCount: Object.keys(registeredTools).length,
        toolNames: Object.keys(allTools).join(', ')
      }
    );
  } catch (error) {
    logger.error(
      LogCategory.NODE,
      '[NodeRegistry]',
      'Failed to initialize tool registry:',
      { error }
    );
    throw error;
  }
}

// Initialize the tool registry when this module is loaded - REMOVED
// initToolRegistry();
