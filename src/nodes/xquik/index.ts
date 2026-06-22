/**
 * @fileoverview Xquik tool implementation for searching public X posts.
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import {
  createToolResult,
  formatErrorMessage
} from '@/lib/utils/markdown-utils';
import type { Tool } from '../types';
import { searchXquikPosts } from './api';
import { XquikSearchResults } from './components';

const xquikSearchPostsSchema = z.object({
  query: z.string().describe('X search query, hashtag, status URL, or post ID'),
  queryType: z
    .enum(['Latest', 'Top'])
    .optional()
    .default('Latest')
    .describe('Sort order for results'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of posts to return'),
  cursor: z.string().optional().describe('Pagination cursor from Xquik'),
  apiKey: z
    .string()
    .optional()
    .describe('Optional Xquik API key, otherwise uses XQUIK_API_KEY'),
  baseUrl: z.string().url().optional().describe('Optional Xquik API base URL')
});

type XquikSearchPostsParams = z.infer<typeof xquikSearchPostsSchema>;

export const xquikSearchPostsTool: Tool = {
  name: 'xquik_search_posts',
  description: 'Search public X posts with Xquik',
  parameters: xquikSearchPostsSchema,
  async execute({
    apiKey,
    baseUrl,
    cursor,
    limit = 10,
    query,
    queryType = 'Latest'
  }: XquikSearchPostsParams) {
    logger.debug(LogCategory.NODE, '[Xquik]', 'Searching public X posts', {
      limit,
      queryType
    });

    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return createToolResult(
          'xquik_search_error',
          formatErrorMessage('Error', 'Please provide a non-empty query.')
        );
      }

      const results = await searchXquikPosts({
        apiKey,
        baseUrl,
        cursor,
        limit,
        query: trimmedQuery,
        queryType
      });

      return XquikSearchResults({
        hasMore: results.hasMore,
        nextCursor: results.nextCursor,
        posts: results.posts,
        query: trimmedQuery
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Xquik]', 'Search execution error', {
        error
      });

      const message = error instanceof Error ? error.message : String(error);
      return createToolResult(
        'xquik_search_error',
        formatErrorMessage('Error', message)
      );
    }
  }
};

export const tools = {
  xquik_search_posts: xquikSearchPostsTool
};
