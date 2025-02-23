import { BaseNode } from 'agentdock-core';
import type { NodeMetadata, NodePort } from 'agentdock-core';
import type { ChatNodeConfig, ChatNodeMetadata } from './types';

export class ChatNode extends BaseNode<ChatNodeConfig> {
  type: 'CHAT' = 'CHAT';
  chatMetadata: ChatNodeMetadata;

  constructor(id: string, config: ChatNodeConfig) {
    super(id, config);
    this.chatMetadata = {
      created: Date.now(),
      messages: []
    };
  }

  getCategory(): "core" | "custom" {
    return "core";
  }

  getLabel(): string {
    return 'Chat Node';
  }

  getDescription(): string {
    return 'A node that handles chat interactions';
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCompatibility(): { core: boolean; pro: boolean; custom: boolean; } {
    return {
      core: true,
      pro: false,
      custom: false
    };
  }

  getInputs(): NodePort[] {
    return [];
  }

  getOutputs(): NodePort[] {
    return [];
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async execute(): Promise<void> {
    // Execution handled by chat interface
  }

  override metadata: NodeMetadata = {
    label: this.getLabel(),
    description: this.getDescription(),
    inputs: this.getInputs(),
    outputs: this.getOutputs(),
    category: this.getCategory(),
    version: this.getVersion(),
    compatibility: this.getCompatibility()
  };
} 