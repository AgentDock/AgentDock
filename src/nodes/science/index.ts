/**
 * @fileoverview Science tools implementation for accessing scientific and medical APIs.
 * Provides tools for searching and retrieving scientific papers and medical information.
 */

import { LogCategory, logger } from 'agentdock-core';

import { Tool, ToolCollection } from '../types';
import { tools as arxivTools } from './arxiv';
import { tools as openAlexTools } from './open-alex';
// Import tools from each science API implementation
import { tools as pubmedTools } from './pubmed';
import { tools as semanticScholarTools } from './semantic-scholar';

// Export tools for registry
export const tools: ToolCollection = {
  // Add implemented science API tools
  ...pubmedTools,
  ...openAlexTools,
  ...arxivTools,
  ...semanticScholarTools
};

// Log initialization
logger.info(
  LogCategory.NODE,
  'ScienceTools',
  'Initialized science tools module',
  {
    toolCount: Object.keys(tools).length,
    availableTools: Object.keys(tools).join(', ')
  }
);
