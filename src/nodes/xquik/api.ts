/**
 * @fileoverview Xquik API client for public X post search.
 */

export interface XquikAuthor {
  id?: string;
  name?: string;
  username?: string;
  verified?: boolean;
}

export interface XquikPost {
  id?: string;
  text?: string;
  created?: number;
  created_at?: string;
  createdAt?: string;
  like_count?: number;
  likeCount?: number;
  retweet_count?: number;
  retweetCount?: number;
  reply_count?: number;
  replyCount?: number;
  quote_count?: number;
  quoteCount?: number;
  view_count?: number;
  viewCount?: number;
  bookmark_count?: number;
  bookmarkCount?: number;
  url?: string;
  author?: XquikAuthor;
}

interface XquikErrorBody {
  error?: string | { message?: string; code?: string; type?: string };
  message?: string;
}

interface XquikSearchResponse {
  tweets?: XquikPost[];
  has_more?: boolean;
  has_next_page?: boolean;
  next_cursor?: string;
  nextCursor?: string;
}

export interface XquikSearchResult {
  posts: XquikPost[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface XquikSearchOptions {
  cursor?: string;
  limit: number;
  query: string;
  queryType: 'Latest' | 'Top';
}

const DEFAULT_BASE_URL = 'https://xquik.com/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;

function resolveApiKey(): string {
  const key = process.env.XQUIK_API_KEY;
  if (!key) {
    throw new Error('XQUIK_API_KEY is not configured.');
  }
  return key;
}

function getErrorMessage(body: XquikErrorBody, status: number): string {
  if (typeof body.error === 'object' && body.error?.message) {
    return body.error.message;
  }
  if (typeof body.error === 'string') {
    return body.message || body.error;
  }
  return body.message || `Xquik API returned HTTP ${status}`;
}

function normalizeErrorMessage(message: string, status: number): string {
  if (status === 401) {
    return 'Xquik API key is missing or invalid.';
  }
  if (status === 402) {
    return 'Xquik returned payment required. Check your Xquik account access.';
  }
  if (status === 429) {
    return 'Xquik rate limit reached. Try again later.';
  }
  return message;
}

async function readJsonResponse(
  response: Response
): Promise<XquikSearchResponse | XquikErrorBody> {
  try {
    return (await response.json()) as XquikSearchResponse | XquikErrorBody;
  } catch {
    if (!response.ok) {
      throw new Error(
        normalizeErrorMessage(
          `Xquik API returned HTTP ${response.status}`,
          response.status
        )
      );
    }
    throw new Error('Xquik returned an invalid JSON response.');
  }
}

export async function searchXquikPosts({
  cursor,
  limit,
  query,
  queryType
}: XquikSearchOptions): Promise<XquikSearchResult> {
  const key = resolveApiKey();
  const url = new URL(`${DEFAULT_BASE_URL}/x/tweets/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('queryType', queryType);
  url.searchParams.set('limit', String(limit));
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': key,
        Accept: 'application/json'
      },
      cache: 'no-store',
      signal: controller.signal
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        normalizeErrorMessage(
          getErrorMessage(data as XquikErrorBody, response.status),
          response.status
        )
      );
    }

    const body = data as XquikSearchResponse;
    return {
      posts: Array.isArray(body.tweets) ? body.tweets : [],
      hasMore: Boolean(body.has_more ?? body.has_next_page),
      nextCursor: body.next_cursor ?? body.nextCursor
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Xquik request timed out. Try again later.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
