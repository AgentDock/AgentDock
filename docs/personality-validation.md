# Personality Validation with Branded Types

This document explains the approach used for validating and transforming the `personality` field in agent configurations.

## Overview

The AgentDock framework supports both string and array formats for the `personality` field in agent templates. However, the Anthropic API requires the system prompt to be a string. To ensure type safety while maintaining flexibility, we use Zod's branded types to validate and transform the personality field.

## Implementation

### 1. Branded Type Definition

```typescript
// In agentdock-core/src/types/agent-config.ts
export const PersonalitySchema = z.union([
  z.string(),
  z.array(z.string()).transform(arr => arr.join('\n'))
]).brand<'validated-personality'>();

export type ValidatedPersonality = z.infer<typeof PersonalitySchema>;
```

This creates a branded type that can only be created through validation. The schema accepts either a string or an array of strings, and transforms arrays into strings by joining with newlines.

### 2. Interface Definition

```typescript
export interface AgentConfig {
  // ... other fields
  personality: ValidatedPersonality;
  // ... other fields
}
```

By using the branded type in the interface, we ensure that only validated personalities can be assigned to this field.

### 3. Schema Validation

```typescript
export const AgentConfigSchema = z.object({
  // ... other fields
  personality: PersonalitySchema,
  // ... other fields
});
```

The schema uses the same `PersonalitySchema` for validation, ensuring consistency.

### 4. Usage in API

```typescript
// In src/app/api/chat/[agentId]/route.ts
const systemPrompt = system || config.personality;

// Use in API call
const stream = await streamText({
  // ... other parameters
  system: systemPrompt,
  // ... other parameters
});
```

Since `config.personality` is guaranteed to be a string due to the branded type, we can use it directly without additional validation.

## Benefits

1. **Type Safety**: The type system enforces that only validated personalities can be used.
2. **Single Source of Truth**: Transformation happens in one place (the schema).
3. **Flexibility**: Supports both string and array formats for better readability.
4. **Reduced Runtime Checks**: No need for redundant string conversion at runtime.
5. **Clear Intent**: The branded type makes it clear that the value has been validated.

## Example

### Template Definition (JSON)

```json
{
  "personality": [
    "You are a helpful AI assistant.",
    "You should respond to user queries in a clear and concise manner.",
    "When appropriate, use examples to illustrate your points."
  ]
}
```

### After Validation

```typescript
// The personality field is now a string with newlines
const config = {
  personality: "You are a helpful AI assistant.\nYou should respond to user queries in a clear and concise manner.\nWhen appropriate, use examples to illustrate your points." as ValidatedPersonality
};
```

## Testing

The implementation includes tests to verify:
- String inputs are accepted and preserved
- Array inputs are transformed to strings with newlines
- Invalid inputs are rejected
- The validation works in the context of a complete agent configuration

## Conclusion

This approach provides a robust solution to the "Invalid prompt: system must be a string" error while maintaining the benefits of array-based personality definitions. It leverages TypeScript's type system to enforce correctness at compile time, reducing the need for runtime checks and improving code quality. 