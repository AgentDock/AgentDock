/**
 * @fileoverview Chat component types
 */

import type { BaseToolInvocation, ToolState } from 'agentdock-core';

import type { Message } from 'agentdock-core/client';

/**
 * Chat message animation types
 */
export type Animation = 'none' | 'fade' | 'slideIn' | 'bounce';

/**
 * Tool invocation with additional properties
 */
export type ToolInvocation = Omit<BaseToolInvocation, 'state'> & {
  state: ToolState | 'partial-call';
  result?:
    | {
        content?: string;
        [key: string]: any;
      }
    | any;
};

/**
 * Properties for ChatMessage component
 */
export interface ChatMessageProps
  extends Pick<
    Message,
    | 'role'
    | 'content'
    | 'createdAt'
    | 'experimental_attachments'
    | 'toolInvocations'
  > {
  showTimeStamp?: boolean;
  animation?: Animation;
  className?: string;
  actions?: React.ReactNode;
  isStreaming?: boolean;
}
