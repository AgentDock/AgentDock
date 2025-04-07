/**
 * @fileoverview Utilities for generating system prompts with orchestration guidance.
 */

import { OrchestrationConfig, TokenOptimizationOptions } from '../types/orchestration';

// NEW: Interface for dynamic state to inject
// EXPORT the interface
export interface DynamicOrchestrationState {
  activeStepName?: string;
  recentlyUsedTools?: string[];
}

/**
 * Creates a complete system prompt string from an agent configuration,
 * including personality, static orchestration guidance, and dynamic state.
 * 
 * @param agentConfig The agent configuration object
 * @param dynamicState Optional dynamic state information for the current turn
 * @returns The formatted system prompt string
 */
export function createSystemPrompt(
  agentConfig: any, 
  dynamicState?: DynamicOrchestrationState
): string {
  if (!agentConfig) {
    return '';
  }

  // Start with the personality as the base prompt
  const personality = agentConfig.personality;
  const basePrompt = typeof personality === 'string' 
    ? personality 
    : Array.isArray(personality) ? personality.join('\n') : String(personality || '');

  let finalPrompt = basePrompt;

  // Add static orchestration guidance if available
  if (agentConfig.orchestration) {
    const tokenOptions = agentConfig.options?.tokenOptimization;
    finalPrompt = addOrchestrationToPrompt(finalPrompt, agentConfig.orchestration, tokenOptions);
  }

  // Add dynamic state information if provided
  if (dynamicState) {
    finalPrompt = addDynamicStateToPrompt(finalPrompt, dynamicState);
  }

  return finalPrompt;
}

/**
 * Adds static orchestration guidance (rules, steps) to an existing system prompt
 * 
 * @param systemPrompt The base system prompt
 * @param orchestration The orchestration configuration
 * @param tokenOptions Token optimization options
 * @returns The combined system prompt with static orchestration guidance
 */
export function addOrchestrationToPrompt(
  systemPrompt: string, 
  orchestration: OrchestrationConfig,
  tokenOptions?: TokenOptimizationOptions
): string {
  if (!orchestration || !orchestration.steps || orchestration.steps.length === 0) {
    return systemPrompt;
  }
  
  // Default to detailed orchestration if not specified
  const includeDetailed = tokenOptions?.includeDetailedOrchestration !== false;
  
  let orchestrationText = '\n\n# Orchestration Guide\n';
  
  // Add description if available
  // MODIFIED: Handle string or array for description
  if (orchestration.description) {
    const descriptionContent = typeof orchestration.description === 'string'
        ? orchestration.description
        : Array.isArray(orchestration.description) ? orchestration.description.join('\n')
        : String(orchestration.description || ''); // Fallback just in case
    orchestrationText += `${descriptionContent}\n\n`;
  } else {
    orchestrationText += 'Follow these steps based on the context of the conversation:\n\n';
  }
  
  if (includeDetailed) {
    // Generate detailed orchestration guide
    orchestrationText += generateDetailedOrchestrationGuide(orchestration);
  } else {
    // Generate compact orchestration guide
    orchestrationText += generateCompactOrchestrationGuide(orchestration);
  }
  
  return systemPrompt + orchestrationText;
}

// NEW: Function to add dynamic state to the prompt
/**
 * Adds dynamic orchestration state (current step, recent tools) to the prompt.
 * 
 * @param systemPrompt The prompt built so far (personality + static orchestration)
 * @param dynamicState The dynamic state information
 * @returns The prompt with dynamic state appended
 */
function addDynamicStateToPrompt(
  systemPrompt: string,
  dynamicState: DynamicOrchestrationState
): string {
  let stateText = '\n\n---\nCurrent Orchestration Context:\n';
  let addedState = false;

  if (dynamicState.activeStepName) {
    stateText += `- Active Step: ${dynamicState.activeStepName}\n`;
    addedState = true;
  }

  if (dynamicState.recentlyUsedTools && dynamicState.recentlyUsedTools.length > 0) {
    stateText += `- Recently Used Tools (this turn): ${dynamicState.recentlyUsedTools.join(', ')}\n`;
    addedState = true;
  }

  if (!addedState) {
    stateText += '- No specific step active or tools used yet.\n';
  }
  
  stateText += '---';

  return systemPrompt + stateText;
}

/**
 * Generates a detailed orchestration guide with full conditions and tool descriptions
 */
function generateDetailedOrchestrationGuide(orchestration: OrchestrationConfig): string {
  let guide = '';
  
  // Add each step with conditions and tools
  orchestration.steps.forEach((step, index) => {
    guide += `## Step ${index + 1}: ${step.name}\n`;
    guide += `${step.description}\n`;
    
    // Add conditions
    if (step.conditions && step.conditions.length > 0) {
      guide += '\nActivate when:\n';
      step.conditions.forEach(condition => {
        let conditionText = '- ';
        
        switch (condition.type) {
          case 'tool_used':
            conditionText += `After using the "${condition.value}" tool`;
            break;
            
          default:
            conditionText += `${condition.type}: ${condition.value}`;
        }
        
        if (condition.description) {
          conditionText += ` (${condition.description})`;
        }
        
        guide += `${conditionText}\n`;
      });
    }
    
    // Add available tools
    if (step.availableTools) {
      guide += '\nAvailable tools:\n';
      
      if (step.availableTools.allowed && step.availableTools.allowed.length > 0) {
        guide += '- Allowed: ' + step.availableTools.allowed.join(', ') + '\n';
      }
      
      if (step.availableTools.denied && step.availableTools.denied.length > 0) {
        guide += '- Denied: ' + step.availableTools.denied.join(', ') + '\n';
      }
    }
    
    guide += '\n';
  });
  
  return guide;
}

/**
 * Generates a compact orchestration guide with minimal information to save tokens
 */
function generateCompactOrchestrationGuide(orchestration: OrchestrationConfig): string {
  let guide = '';
  
  // Add each step with minimal information
  orchestration.steps.forEach((step, index) => {
    guide += `## ${step.name}\n`;
    guide += `${step.description}\n`;
    
    // Just mention condition types without details
    if (step.conditions && step.conditions.length > 0) {
      const conditionTypes = new Set(step.conditions.map(c => c.type));
      guide += `Activates on: ${Array.from(conditionTypes).join(', ')}\n`;
    }
    
    // Just mention tool categories
    if (step.availableTools) {
      if (step.availableTools.allowed && step.availableTools.allowed.length > 0) {
        guide += `Available tools: ${step.availableTools.allowed.length} tools\n`;
      }
    }
    
    guide += '\n';
  });
  
  return guide;
} 