import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { SecureStorage } from 'agentdock-core';
import { Agent, AgentState } from '@/lib/store/types';
import { z } from 'zod';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

// Simple schema for agent creation
const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const storage = SecureStorage.getInstance('agentdock');
    const data = await req.json();
    
    // Generate new agent with required fields
    const now = Date.now();
    const agent: Agent = {
      id: uuidv4(),
      agentId: uuidv4(),
      name: data.name,
      description: data.description || '',
      personality: PersonalitySchema.parse("helpful"),
      modules: [],
      nodeConfigurations: {},
      chatSettings: {
        initialMessages: [],
        historyPolicy: "lastN",
        historyLength: 10
      },
      instructions: data.systemPrompt,
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
    
    // Get existing agents
    const agents = (await storage.get('agents') || []) as Agent[];
    
    // Add new agent
    agents.push(agent);
    
    // Save updated list
    await storage.set('agents', agents);
    await storage.set(`agent:${agent.id}`, agent);
    
    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const storage = SecureStorage.getInstance('agentdock');
    const agents = (await storage.get('agents') || []) as Agent[];
    return NextResponse.json(agents);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 