# Request Flow in AgentDock Core

This document outlines the typical sequence of events when a request is processed by AgentDock Core.

## Request Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Agent
    participant LLM
    participant Tool

    Client->>+API: Send Message (with SessionId)
    API->>+Agent: Process Request
    Agent->>+LLM: Generate Response (incl. History, Filtered Tools)
    
    alt Tool Call Needed
        LLM-->>Agent: Request Tool Execution
        Agent->>+Tool: Execute Tool
        Tool-->>-Agent: Return Result
        Agent->>LLM: Provide Tool Result
        LLM->>Agent: Continue Response Generation
    end

    LLM-->>-Agent: Stream/Complete Response Text
    Agent->>-API: Stream Response Chunks
    API-->>-Client: Stream Response
```

## Detailed Steps

1.  **Request Initiation:** A client sends a request (e.g., a user message, potentially including a `sessionId`) to an API endpoint.
2.  **API Endpoint Handling:** Extracts the `sessionId` and message payload, determining the target `agentId`.
3.  **Agent Instantiation (`AgentNode`):** Creates an instance of `AgentNode`, passing the agent configuration, API keys, and core managers.
4.  **State Retrieval / Initialization:** Loads or creates orchestration state for the session.
5.  **Orchestration & Tool Filtering:** Evaluates conditions to determine the `activeStep` and filters available tools.
6.  **LLM Interaction (`CoreLLM.streamText`):** Prepares the prompt, sets callbacks, and calls the LLM with filtered tools.
7.  **Response Streaming & Tool Handling:** 
    - LLM streams response (text chunks or tool call requests)
    - Tool calls are executed and results returned to the LLM
    - Text chunks are streamed back to the client
8.  **State Updates:** Update token usage, tool history, sequence index, and timestamps.
9.  **Response Completion:** Stream ends and response is finalized.
10. **Cleanup:** `AgentNode` instance is discarded while session state persists.

For implementation details, see [`agentdock-core/src/nodes/agent-node.ts`](../../../agentdock-core/src/nodes/agent-node.ts).

## Enhanced Streaming Flow

AgentDock extends standard streaming with `AgentDockStreamResult`:

```mermaid
sequenceDiagram
    participant Client
    participant Adapter
    participant AgentNode
    participant LLMService as LLMOrchestrationService
    participant CoreLLM
    participant LLM as LLM Provider
    
    Client->>Adapter: Request
    Adapter->>AgentNode: handleMessage()
    AgentNode->>LLMService: streamWithOrchestration()
    LLMService->>CoreLLM: streamText()
    CoreLLM->>LLM: API Call with Streaming
    
    loop For each token/chunk
        LLM-->>CoreLLM: Token/Chunk
        CoreLLM-->>LLMService: Enhanced Stream
        LLMService-->>Adapter: AgentDockStreamResult
        Adapter-->>Client: Streaming Response
    end

    LLM-->>CoreLLM: onFinish()
    CoreLLM-->>LLMService: Update state
    LLMService-->>Adapter: Stream completion
```

This enhanced flow provides:

1. **Automatic State Management**: Updates token usage and tracks tools used
2. **Error Handling**: Propagates errors from LLM providers with better context
3. **Tool Orchestration**: Manages tool execution and updates session state

For details on streaming implementation, see [Response Streaming](./response-streaming.md).