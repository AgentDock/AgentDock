/**
 * @fileoverview Output formatting for Xquik search results.
 */

import {
  cleanText,
  createToolResult,
  formatBold,
  formatHeader,
  formatLink,
  joinSections
} from '@/lib/utils/markdown-utils';
import type { XquikPost } from './api';

interface XquikSearchResultsProps {
  hasMore: boolean;
  nextCursor?: string;
  posts: XquikPost[];
  query: string;
}

function numberValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getPostUrl(post: XquikPost): string | undefined {
  if (post.url) return post.url;
  if (post.id && post.author?.username) {
    return `https://x.com/${post.author.username}/status/${post.id}`;
  }
  return undefined;
}

function getCreatedLabel(post: XquikPost): string | undefined {
  if (typeof post.created === 'number') {
    return new Date(post.created * 1000).toISOString();
  }
  return post.created_at ?? post.createdAt;
}

function formatPost(post: XquikPost, index: number): string {
  const username = post.author?.username ? `@${post.author.username}` : 'X';
  const displayName = post.author?.name
    ? `${post.author.name} (${username})`
    : username;
  const text = cleanText(post.text || 'No text available.');
  const created = getCreatedLabel(post);
  const url = getPostUrl(post);
  const metrics = [
    `${numberValue(post.like_count ?? post.likeCount)} likes`,
    `${numberValue(post.retweet_count ?? post.retweetCount)} reposts`,
    `${numberValue(post.reply_count ?? post.replyCount)} replies`
  ].join(', ');
  const sourceLink = url ? ` ${formatLink('Open post', url)}` : '';
  const createdLine = created ? `\n${created}` : '';

  return `${formatBold(`${index + 1}. ${displayName}`)}${sourceLink}${createdLine}\n${text}\n${metrics}`;
}

export function XquikSearchResults(props: XquikSearchResultsProps) {
  const header = formatHeader(`Xquik Results for "${props.query}"`);

  if (props.posts.length === 0) {
    return createToolResult(
      'xquik_search_results',
      joinSections(header, 'No posts found.')
    );
  }

  const postSections = props.posts.map(formatPost).join('\n\n');
  const pagination = props.hasMore
    ? `More results are available with cursor: ${props.nextCursor || 'available'}`
    : '';

  return createToolResult(
    'xquik_search_results',
    joinSections(header, postSections, pagination)
  );
}
