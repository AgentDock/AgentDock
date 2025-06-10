import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { SecureStorage } from 'agentdock-core/storage/secure-storage';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

import { Agent, AgentState } from '@/lib/store/types';

// Simple schema for agent creation
const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().optional()
});

/**
 * POST /api/agents
 * Creates a new agent with the provided data
 * Note: This endpoint is currently not used in the application as agents are
 * created from templates in the store initialization process.
 */
export async function POST(req: Request) {
  try {
    const storage = SecureStorage.getInstance('agentdock');
    const data = await req.json();

    // Validate input data
    const validatedData = createAgentSchema.parse(data);

    // Generate new agent with required fields
    const now = Date.now();
    const agent: Agent = {
      id: uuidv4(),
      agentId: uuidv4(),
      name: validatedData.name,
      description: validatedData.description || '',
      personality: PersonalitySchema.parse('helpful'),
      nodes: [],
      nodeConfigurations: {},
      chatSettings: {
        initialMessages: [],
        historyPolicy: 'lastN',
        historyLength: 10
      },
      instructions: validatedData.systemPrompt || '',
      state: AgentState.CREATED,
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
    const agents = ((await storage.get('agents')) || []) as Agent[];

    // Add new agent
    agents.push(agent);

    // Save updated list
    await storage.set('agents', agents);

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/agents
 * Returns a list of agents
 * Note: This endpoint is currently not used in the application as agents are
 * loaded from templates in the store initialization process.
 */
export async function GET() {
  try {
    const storage = SecureStorage.getInstance('agentdock');
    const agents = ((await storage.get('agents')) || []) as Agent[];
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to retrieve agents:', error);

    // Return an empty array instead of mock data
    return NextResponse.json([]);
  }
}
