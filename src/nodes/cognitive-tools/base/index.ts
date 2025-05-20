/**
 * Base utilities for cognitive tool enhancement
 *
 * This file provides functions to enhance cognitive tools with content validation
 * and automatic generation using LLMs when content is insufficient.
 */

import { Tool, ToolExecutionOptions } from '../../types';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Interface for tools that support content enhancement
 */
export interface ContentEnhanceable {
  validateContent: (params: any) => boolean;
  enhanceContent: (params: any, options: ToolExecutionOptions) => Promise<any>;
}

/**
 * Enhances a tool with content validation and generation capabilities
 * @param tool The original tool to enhance
 * @param contentField The parameter field that contains the main content
 * @param minLength Minimum required content length
 * @param getPrompt Function to generate the prompt for content enhancement
 * @returns The enhanced tool
 */
export function enhanceCognitiveTool(
  tool: Tool,
  contentField: string,
  minLength: number = 100,
  getPrompt: (params: any) => string,
): Tool & ContentEnhanceable {
  // Create the enhanced tool
  const enhancedTool: Tool & ContentEnhanceable = {
    ...tool,

    // Add content validation method
    validateContent(params: any): boolean {
      const content = params[contentField];
      return !!content && typeof content === 'string' && content.length >= minLength;
    },

    // Add content enhancement method
    async enhanceContent(params: any, options: ToolExecutionOptions): Promise<any> {
      if (!options.llmContext?.llm) {
        logger.warn(LogCategory.NODE, `${tool.name}`, `No LLM available for content enhancement`);
        return params;
      }

      const prompt = getPrompt(params);

      try {
        const response = await options.llmContext.llm.generateText({
          messages: [
            {
              role: 'system',
              content:
                'You are an expert reasoning assistant that provides detailed, structured analysis.',
            },
            { role: 'user', content: prompt },
          ],
        });

        logger.debug(LogCategory.NODE, `${tool.name}`, `Enhanced content for ${contentField}`, {
          toolCallId: options.toolCallId,
          enhanced: true,
          originalLength: params[contentField]?.length || 0,
          enhancedLength: response.text.length,
        });

        return {
          ...params,
          [contentField]: response.text,
        };
      } catch (error) {
        logger.error(LogCategory.NODE, `${tool.name}`, `Failed to enhance content`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return params;
      }
    },

    // Override execute to include content validation and enhancement
    async execute(params: any, options: ToolExecutionOptions) {
      // Check if content needs enhancement
      if (!enhancedTool.validateContent(params)) {
        logger.debug(
          LogCategory.NODE,
          `${tool.name}`,
          `Content validation failed, attempting enhancement`,
          {
            toolCallId: options.toolCallId,
            contentField,
            hasContent: !!params[contentField],
            contentLength: params[contentField]?.length || 0,
            minRequired: minLength,
          },
        );

        // Enhance content if needed
        params = await enhancedTool.enhanceContent(params, options);
      }

      // Call the original execute with potentially enhanced params
      return tool.execute(params, options);
    },
  };

  return enhancedTool;
}
