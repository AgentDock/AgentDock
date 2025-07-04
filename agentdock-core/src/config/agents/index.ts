/**
 * @fileoverview Agent configuration presets
 *
 * Pre-configured memory and lifecycle settings for common agent types.
 * These configurations have been tested and optimized for specific use cases.
 *
 * @note PRODUCTION READINESS: These configurations are based on
 * development testing. Production validation is pending.
 */

export { therapyAgentConfig } from './therapy-agent-config';
export { businessAgentConfig } from './business-agent-config';
export { researchAgentConfig } from './research-agent-config';

/**
 * Quick agent configuration selector
 *
 * @example
 * ```typescript
 * import { getAgentConfig } from '@agentdock/core/config/agents';
 *
 * const config = getAgentConfig('therapy');
 * const memoryManager = new MemoryManager(storage, config.memory);
 * ```
 */
export function getAgentConfig(agentType: 'therapy' | 'business' | 'research') {
  switch (agentType) {
    case 'therapy':
      return require('./therapy-agent-config').therapyAgentConfig;
    case 'business':
      return require('./business-agent-config').businessAgentConfig;
    case 'research':
      return require('./research-agent-config').researchAgentConfig;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}
