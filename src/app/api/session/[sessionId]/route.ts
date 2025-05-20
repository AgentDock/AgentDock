/**
 * @fileoverview API Route to fetch session state, including cumulative token usage.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  logger,
  LogCategory,
  // Assuming getOrchestrationManagerInstance is correctly exported and configured
} from 'agentdock-core';
import { getOrchestrationManagerInstance } from '@/lib/orchestration-adapter'; // Use adapter's instance getter
import { SessionId } from 'agentdock-core/types/session';

export const runtime = 'edge';
export const maxDuration = 60; // Shorter duration for simple state fetch

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  // Await params before accessing sessionId
  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  logger.debug(LogCategory.API, 'SessionRoute', 'Fetching state for session', {
    sessionId: sessionId.substring(0, 8) + '...',
  });

  try {
    const manager = getOrchestrationManagerInstance();
    // Use the manager's getState which returns the AI-facing state object
    const state = await manager.getState(sessionId);

    // DEBUG: Log the raw state object fetched
    logger.debug(LogCategory.API, 'SessionRoute', 'Raw state object fetched', {
      stateObject: JSON.stringify(state), // Log the entire object
    });

    if (!state) {
      logger.warn(LogCategory.API, 'SessionRoute', 'Session state not found', {
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return NextResponse.json({ error: 'Session state not found' }, { status: 404 });
    }

    // Return the relevant parts of the state (including cumulative usage)
    const responsePayload = {
      sessionId: state.sessionId,
      activeStep: state.activeStep,
      recentlyUsedTools: state.recentlyUsedTools || [], // Default to empty array if undefined
      cumulativeTokenUsage: state.cumulativeTokenUsage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }, // Default if undefined
    };

    // DEBUG: Log the exact payload being returned
    logger.debug(LogCategory.API, 'SessionRoute', 'Response payload being sent', {
      payload: JSON.stringify(responsePayload),
    });

    logger.debug(LogCategory.API, 'SessionRoute', 'Successfully fetched session state', {
      sessionId: sessionId.substring(0, 8) + '...',
      hasUsage: !!state.cumulativeTokenUsage,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    logger.error(LogCategory.API, 'SessionRoute', 'Error fetching session state', {
      sessionId: sessionId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error fetching session state' },
      { status: 500 },
    );
  }
}
