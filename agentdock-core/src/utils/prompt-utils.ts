/**
 * @fileoverview Utilities for generating system prompts with orchestration guidance.
 */

import { OrchestrationConfig, TokenOptimizationOptions } from '../types/orchestration';

/**
 * Creates a complete system prompt string from an agent configuration,
 * including personality and orchestration guidance.
 * 
 * @param agentConfig The agent configuration object
 * @returns The formatted system prompt string
 */
export function createSystemPrompt(agentConfig: any): string {
  if (!agentConfig) {
    return '';
  }

  // Start with the personality as the base prompt
  const personality = agentConfig.personality;
  const basePrompt = typeof personality === 'string' 
    ? personality 
    : Array.isArray(personality) ? personality.join('\n') : String(personality || '');

  // Add orchestration guidance if available
  if (agentConfig.orchestration) {
    const tokenOptions = agentConfig.options?.tokenOptimization;
    return addOrchestrationToPrompt(basePrompt, agentConfig.orchestration, tokenOptions);
  }

  return basePrompt;
}

/**
 * Adds orchestration guidance to an existing system prompt
 * 
 * @param systemPrompt The base system prompt
 * @param orchestration The orchestration configuration
 * @param tokenOptions Token optimization options
 * @returns The combined system prompt with orchestration guidance
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
  if (orchestration.description) {
    orchestrationText += `${orchestration.description}\n\n`;
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