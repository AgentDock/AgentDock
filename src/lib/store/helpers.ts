import { v4 as uuidv4 } from 'uuid';
import { BaseNode, SecureStorage } from 'agentdock-core';
import { Agent, AgentTemplate, AgentRuntimeSettings, AgentState } from './types';
import { ChatNode } from './chat-node';

export interface CreateAgentParams {
  name: string;
  description: string;
  systemPrompt?: string;
}

export interface AgentStoreParams {
  storage?: SecureStorage;
}

export interface AgentStore {
  agents: Agent[];
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  storage: SecureStorage;
}

/**
 * Creates a new agent
 */
export async function createAgent(params: CreateAgentParams): Promise<Agent> {
  const id = uuidv4();
  const now = Date.now();

  const agent: Agent = {
    id,
    agentId: id,
    name: params.name,
    description: params.description,
    personality: "helpful",
    modules: [],
    nodeConfigurations: {},
    chatSettings: {
      initialMessages: [],
      historyPolicy: "lastN",
      historyLength: 10
    },
    instructions: params.systemPrompt,
    state: AgentState.CREATED,
    nodes: [],
    runtimeSettings: {
      temperature: 0.7,
      maxTokens: 4096
    },
    metadata: {
      created: now,
      lastStateChange: now
    }
  };

  // Store agent data
  const storage = SecureStorage.getInstance('agentdock');
  await storage.set(`agent:${agent.id}`, agent);

  return agent;
}

export async function createAgentStore(params: AgentStoreParams = {}): Promise<AgentStore> {
  // Initialize storage
  const storage = params.storage || SecureStorage.getInstance('agentdock');

  // Load agents from storage
  const agents: Agent[] = [];
  const storedAgents = await storage.get('agents');
  if (Array.isArray(storedAgents)) {
    agents.push(...storedAgents);
  }

  // Create store methods
  const addAgent = async (agent: Agent) => {
    agents.push(agent);
    await storage.set('agents', agents);
  };

  const removeAgent = async (id: string) => {
    const index = agents.findIndex(a => a.id === id);
    if (index !== -1) {
      agents.splice(index, 1);
      await storage.set('agents', agents);
      await storage.remove(`agent:${id}`);
    }
  };

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    const agent = agents.find(a => a.id === id);
    if (agent) {
      Object.assign(agent, updates, { updatedAt: Date.now() });
      await storage.set('agents', agents);
      await storage.set(`agent:${id}`, agent);
    }
  };

  return {
    agents,
    addAgent,
    removeAgent,
    updateAgent,
    storage
  };
}

export function createChatNode(id: string): ChatNode {
  return new ChatNode(id, {
    model: 'claude-3-opus',
    temperature: 0.7,
    maxTokens: 4096
  });
} 