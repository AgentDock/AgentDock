# Xquik Tool

The Xquik tool lets AgentDock agents search public X posts through the Xquik API.

## Configuration

Set the API key before using the tool:

```bash
XQUIK_API_KEY=your_api_key_here
```

You can optionally override the API base URL:

```bash
XQUIK_BASE_URL=https://xquik.com/api/v1
```

## Tool

### `xquik_search_posts`

Search public X posts by keyword query, hashtag, status URL, or post ID.

Parameters:

- `query` (required): Search query, hashtag, status URL, or post ID
- `queryType` (optional): `Latest` or `Top`, defaults to `Latest`
- `limit` (optional): Maximum number of posts to return, defaults to `10`
- `cursor` (optional): Pagination cursor from a previous Xquik response
- `apiKey` (optional): Xquik API key for per-call overrides
- `baseUrl` (optional): Xquik API base URL for per-call overrides

Example:

```typescript
const result = await agent.executeTool('xquik_search_posts', {
  query: 'AI agents',
  limit: 5
});
```

The tool returns formatted post text, author details, engagement counts, and a
pagination cursor when more results are available.
