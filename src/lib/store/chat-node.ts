import { BaseNode } from 'agentdock-core';
import type { NodePort } from 'agentdock-core';
import type { ChatNodeConfig, ChatNodeMetadata } from './types';

export class ChatNode extends BaseNode<ChatNodeConfig> {
  readonly type: string = 'CHAT';
  chatMetadata: ChatNodeMetadata;

  constructor(id: string, config: ChatNodeConfig) {
    super(id, config);
    this.chatMetadata = {
      created: Date.now(),
      messages: []
    };
  }

  protected getCategory(): "core" | "custom" {
    return "core";
  }

  protected getLabel(): string {
    return 'Chat Node';
  }

  protected getDescription(): string {
    return 'A node that handles chat interactions';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): { core: boolean; pro: boolean; custom: boolean; } {
    return {
      core: true,
      pro: false,
      custom: false
    };
  }

  protected getInputs(): NodePort[] {
    return [{
      id: 'message',
      type: 'string',
      label: 'Message',
      required: true
    }];
  }

  protected getOutputs(): NodePort[] {
    return [{
      id: 'response',
      type: 'string',
      label: 'Response'
    }];
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async execute(): Promise<void> {
    // Execution handled by chat interface
  }
} 