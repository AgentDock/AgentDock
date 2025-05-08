import type { EvaluationInput, AgentMessage, TextContent } from "../types";

/**
 * Extracts a string value from various fields of the EvaluationInput object based on a sourceField string.
 *
 * - If sourceField is undefined or 'response', it attempts to get input.response.
 * - If sourceField is 'prompt', it attempts to get input.prompt.
 * - If sourceField is 'groundTruth', it attempts to get input.groundTruth.
 * - If sourceField starts with 'context.', it attempts to access a nested property within input.context.
 *   For example, 'context.userData.summary' would try to access input.context.userData.summary.
 * - If the target field is an AgentMessage, it extracts the content from the first 'text' content part.
 *
 * @param input The EvaluationInput object.
 * @param sourceField Optional string specifying the source field. Defaults to 'response'.
 * @returns The extracted string, or undefined if the field is not found, not a string, or (for AgentMessage) has no text content part.
 */
export function getInputText(
  input: EvaluationInput,
  sourceField?: string
): string | undefined {
  const field = sourceField || "response";
  let targetValue: any;
  let basePath = field;
  let remainingPath = '';

  if (field.includes('.')) {
    const parts = field.split('.');
    basePath = parts[0];
    remainingPath = parts.slice(1).join('.');
  }

  switch (basePath) {
    case "response":
      targetValue = input.response;
      break;
    case "prompt":
      targetValue = input.prompt;
      break;
    case "groundTruth":
      targetValue = input.groundTruth;
      break;
    case "context": // If basePath is context, remainingPath is the actual context path
      targetValue = input.context;
      // remainingPath is already set correctly from field.split for context.
      break;
    default:
      // if (!field.startsWith("context.")) { // This check is now implicitly handled by basePath logic
      //   return undefined;
      // }
      // For any other basePath, it's an unknown top-level field, or we only support response, prompt, groundTruth, context.
      // If field was something like "unknown.path", basePath would be "unknown".
      // We can decide to return undefined or try to access input[basePath]
      // For now, let's assume if it's not response, prompt, groundTruth, context, it's invalid unless it's a path starting with one of them.
      if (!['response', 'prompt', 'groundTruth', 'context'].includes(basePath)) {
        return undefined; // Invalid base path
      }
      // This case should ideally not be reached if field.includes('.') was handled, 
      // and basePath is one of the known ones, but remainingPath would be empty.
      // This means a direct path like "response." which is invalid.
      // Or if sourceField was just "context" without a path, remainingPath is empty.
      // Let targetValue be input.context and path traversal below handle empty remainingPath for context.
      targetValue = (input as any)[basePath];
      break;
  }
  
  // If there was a remainingPath, traverse it
  if (remainingPath && targetValue !== undefined) {
    const pathParts = remainingPath.split('.');
    let currentValue = targetValue;
    for (const key of pathParts) {
      if (currentValue && typeof currentValue === "object" && key in currentValue) {
        currentValue = currentValue[key];
      } else {
        currentValue = undefined;
        break;
      }
    }
    targetValue = currentValue;
  }

  if (typeof targetValue === "string") {
    return targetValue;
  }

  if (
    targetValue &&
    typeof targetValue === "object" &&
    typeof (targetValue as AgentMessage).role === "string" 
  ) {
    const agentMessage = targetValue as AgentMessage;
    // console.log(`DEBUG: getInputText processing AgentMessage. ID: ${agentMessage.id}, contentParts: ${JSON.stringify(agentMessage.contentParts)}`);

    if (Array.isArray(agentMessage.contentParts)) {
      // console.log(`DEBUG: getInputText - contentParts is array. Length: ${agentMessage.contentParts.length}`);
      for (const part of agentMessage.contentParts) {
        // console.log(`DEBUG: getInputText - iterating part: ${JSON.stringify(part)}`);
        if (part && typeof part === 'object' && part.type === "text") {
          // console.log(`DEBUG: getInputText - part is text type.`);
          if ('text' in part && typeof (part as TextContent).text === "string") {
            // console.log(`DEBUG: getInputText - returning part.text: ${(part as TextContent).text}`);
            return (part as TextContent).text;
          }
        }
      }
      // console.log('DEBUG: getInputText - no text part found in contentParts array, returning undefined.');
    }
    // If contentParts is not an array, or is an array but no text part was found, return undefined.
    return undefined; 
  }
  
  // This check handles cases where groundTruth might be an object but not an AgentMessage.
  // And ensures that if field is 'groundTruth' and targetValue is an object (but not AgentMessage), it returns undefined.
  if (field === "groundTruth" && targetValue !== undefined && typeof targetValue !== 'string') {
    return undefined;
  }

  return undefined;
} 