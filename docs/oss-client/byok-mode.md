# Bring Your Own Keys (BYOK) Mode

## Overview

BYOK (Bring Your Own Keys) mode is a security setting in the AgentDock Open Source Client that controls how API keys are managed. When enabled, AgentDock will **only** use API keys that have been explicitly provided by the user through the settings interface, and will never fall back to environment variables.

This feature provides an additional layer of security and transparency, especially in multi-user or shared environments where users should be responsible for their own API key usage.

## Configuration Options

BYOK mode can be configured in two ways, listed in order of priority:

1. **URL Parameter**: Add `?byokMode=true` or `?byokMode=false` to any AgentDock URL (temporary override)
2. **Settings Interface**: Toggle the "Bring Your Own Keys Mode" switch in the Settings page (persistent setting)

## Implementation Details

BYOK mode is implemented across several key components in the AgentDock architecture:

### Client-Side Components

1. **Environment Override Provider** (`src/components/env-override-provider.tsx`):
   - Handles the URL parameter `byokMode=true|false`
   - Stores the setting in localStorage for persistence
   - Ensures the setting is available to all components

2. **Chat Container** (`src/components/chat/chat-container.tsx`):
   - Reads BYOK setting from localStorage
   - Adds the `x-byok-mode` header to API requests
   - Includes proper error handling for BYOK-related errors

### Server-Side Components

1. **API Route Handler** (`src/app/api/chat/[agentId]/route.ts`):
   - Reads the `x-byok-mode` header from requests
   - Implements the API key resolution logic with BYOK mode awareness
   - Provides detailed error messages when API keys are missing in BYOK mode

2. **Environment Types** (`src/types/env.ts`):
   - Defines type-safe interfaces for BYOK mode
   - Centralizes API key resolution logic

## API Key Resolution Logic

When a request is made to the API, the following resolution logic is applied:

1. Try to get API key from request headers (`x-api-key`)
2. Try to get API key from global settings in secure storage
3. If BYOK mode is enabled and no key is found, throw an error
4. If BYOK mode is disabled, fall back to environment variables

```typescript
// Simplified version of the API key resolution logic
async function resolveApiKey(request, provider, isByokOnly) {
  // Try request headers
  let apiKey = request.headers.get('x-api-key');
  
  // Try global settings
  if (!apiKey) {
    const globalSettings = await storage.get("global_settings");
    apiKey = globalSettings?.apiKeys?.[provider];
  }
  
  // If BYOK mode is enabled and no key, throw error
  if (isByokOnly && !apiKey) {
    throw new APIError(
      'API key is required. In "Bring Your Own Keys Mode", you must provide your own API key in settings.',
      ErrorCode.LLM_API_KEY
    );
  }
  
  // If BYOK mode is disabled, try environment variables
  if (!apiKey && !isByokOnly) {
    apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  }
  
  return apiKey;
}
```

## Error Handling

When an API key is required but not found in BYOK mode, the API returns a specific error:

```json
{
  "error": "API key is required. In \"Bring Your Own Keys Mode\", you must provide your own API key in settings.",
  "code": "LLM_API_KEY",
  "details": {
    "provider": "openai"
  }
}
```

The client displays this as a user-friendly error message with a link to the settings page.

## BYOK in AgentDock Pro vs. Open Source

The Open Source Client requires you to provide your own API keys for all services. **AgentDock Pro** enhances this model:

### AgentDock Pro Benefits

- **Cost-Effective API Access**:
  - Get LLM and API services at lower prices than going directly to providers
  - Save 80-90% compared to setting up individual accounts with each provider
  - Utilize bulk purchasing power for better rates across all services

- **Simplified Cost Management**:
  - Single billing relationship instead of managing multiple provider accounts
  - Predictable pricing with unified credit system
  - No minimum spend requirements that many premium services impose

- **Enterprise-Grade Access**:
  - Access to enterprise tiers without meeting enterprise qualification criteria
  - Higher rate limits without lengthy approval processes
  - Premium services at a fraction of direct provider costs

AgentDock Pro eliminates the overhead of managing relationships with multiple AI and API providers, delivering superior economics for production deployments.

## Best Practices

- **Development Environment**: Disable BYOK mode for easier testing with environment variables
- **Production Environment**: Consider enabling BYOK mode to ensure users are accountable for their own API key usage
- **Sensitive Deployments**: Always enable BYOK mode in environments where API key usage needs to be strictly controlled
- **Cost Optimization**: For commercial deployments, consider AgentDock Pro for significant cost savings across multiple services

## Security Considerations

1. **API Key Storage**: User-provided API keys are stored in SecureStorage, which encrypts the data
2. **BYOK Setting Storage**: The BYOK mode setting itself is stored in localStorage for accessibility
3. **Header Security**: The `x-byok-mode` header is validated server-side to prevent tampering

## Debugging BYOK Mode

When troubleshooting BYOK mode issues:

1. Check localStorage for the `byokOnly` key
2. Verify request headers include `x-byok-mode`
3. Check console logs in development mode for detailed information about API key resolution
4. Use Network tab in browser dev tools to inspect API responses for error messages 