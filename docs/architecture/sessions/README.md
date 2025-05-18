# Session Management

This directory contains documentation about AgentDock's session management system.

## Overview

Sessions in AgentDock provide isolation between concurrent conversations and maintain state across multiple requests. They are a critical part of the architecture that enables:

- Stateful conversations with LLM agents
- Tool context persistence
- Orchestration state management
- Memory efficiency and resource optimization

## Documentation Files

- [session-overview.md](./session-overview.md) - Core concepts and architecture of the session system
- [session-implementation.md](./session-implementation.md) - Technical implementation details and API
- [session-optimization.md](./session-optimization.md) - Performance optimizations and memory management
- [nextjs-integration.md](./nextjs-integration.md) - How sessions integrate with Next.js applications
