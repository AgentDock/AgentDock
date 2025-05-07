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

  switch (field) {
    case "response":
      targetValue = input.response;
      break;
    case "prompt":
      targetValue = input.prompt;
      break;
    case "groundTruth":
      targetValue = input.groundTruth;
      break;
    default:
      if (field.startsWith("context.")) {
        const contextPath = field.substring("context.".length).split(".");
        let currentContext = input.context;
        for (const key of contextPath) {
          if (currentContext && typeof currentContext === "object" && key in currentContext) {
            currentContext = currentContext[key];
          } else {
            currentContext = undefined;
            break;
          }
        }
        targetValue = currentContext;
      } else {
        return undefined;
      }
      break;
  }

  if (typeof targetValue === "string") {
    return targetValue;
  }

  if (
    targetValue &&
    typeof targetValue === "object" &&
    typeof (targetValue as AgentMessage).role === "string" 
  ) {
    const agentMessage = targetValue as AgentMessage; // Assert once
    // Check for contentParts and ensure it is an array
    if (agentMessage.contentParts && Array.isArray(agentMessage.contentParts)) {
      // Now agentMessage.contentParts is known to be an array here
      for (const part of agentMessage.contentParts) { 
        if (part.type === "text") {
          const textContent = part as TextContent; 
          if (typeof textContent.text === "string") { 
            return textContent.text;
          }
        }
      }
    }
  }
  
  if (field === "groundTruth" && targetValue !== undefined && typeof targetValue !== 'string') {
    return undefined;
  }

  return undefined;
} 