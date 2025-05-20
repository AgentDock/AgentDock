/**
 * Cognitive Tools Index
 *
 * This file exports all cognitive enhancement tools that improve LLM reasoning
 * without requiring external API calls or retrieving external data.
 */

import { tools as thinkTools } from './think';
import { tools as reflectTools } from './reflect';
import { tools as compareTools } from './compare';
import { tools as critiqueTools } from './critique';
import { tools as debateTools } from './debate';
import { tools as brainstormTools } from './brainstorm';

/**
 * Export tools directly for the registry
 * IMPORTANT: The keys used here must match what's referenced in the agent template
 */
export const tools = {
  ...thinkTools,
  ...reflectTools,
  ...compareTools,
  ...critiqueTools,
  ...debateTools,
  ...brainstormTools,
};
