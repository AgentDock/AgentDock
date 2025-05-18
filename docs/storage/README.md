# Storage System Overview

AgentDock Core provides a flexible and extensible storage system designed to handle various data persistence needs, from session state to configuration and potentially large-scale memory or vector data in the future.

## Core Concepts

- **Abstraction:** A primary goal is to abstract the underlying storage mechanism, allowing developers to choose the backend that best fits their deployment needs (e.g., in-memory for development, Redis for scalable deployments, Vercel KV for Vercel hosting).
- **Purpose-Driven Configuration:** Different types of data (Key-Value, Vector, Relational) will ideally be configurable with distinct providers based on their requirements (e.g., using Redis for session KV and pgvector for Vector storage).
- **Session Scoping:** Much of the core storage usage revolves around managing session-specific data with appropriate isolation and lifecycle management (TTL).
- **Security:** Includes components like `SecureStorage` for handling sensitive data client-side.

## Key Components (`agentdock-core/src/storage`)

1.  **Storage Abstraction Layer (SAL):**

    - **Interface (`StorageProvider`):** Defines the standard contract for Key-Value storage operations (`get`, `set`, `delete`, `exists`, etc.).
    - **Factory (`StorageFactory`, `getStorageFactory`):** Instantiates the configured `StorageProvider` based on environment variables (`KV_STORE_PROVIDER`, `REDIS_URL`, etc.). Manages provider instances.
    - **Implementations (`/providers`):**
      - `MemoryStorageProvider`: Default in-memory KV store.
      - `RedisStorageProvider`: Uses `@upstash/redis` for Redis/Upstash KV storage.
      - `VercelKVProvider`: Uses `@vercel/kv` for Vercel KV storage.
    - _(Planned: Interfaces and providers for Vector and Relational storage)_

2.  **Secure Storage (`SecureStorage`):**
    - A separate utility class designed for **client-side (browser)** secure storage.
    - Uses the Web Crypto API (AES-GCM) for encryption and HMAC for integrity checking.
    - Typically used for storing sensitive browser-side data like user-provided API keys in `localStorage`.
    - **Note:** This is distinct from the server-side Storage Abstraction Layer used by `SessionManager`, etc.

## Integration with Other Subsystems

- **Session Management:** `SessionManager` relies _directly_ on the SAL (`StorageProvider` via `StorageFactory`) to persist session state.
- **Orchestration Framework:** `OrchestrationStateManager` uses `SessionManager`, thus indirectly depending on the SAL for persisting orchestration state.
- **(Planned) Advanced Memory / RAG:** Will likely leverage both the Key-Value SAL (for metadata) and the future Vector Storage components.

## Current Status & Usage

- The Key-Value part of the Storage Abstraction Layer is implemented and stable, supporting Memory, Redis, and Vercel KV.
- This KV storage is actively used by `SessionManager` and `OrchestrationStateManager` for persistence when configured (defaults to Memory).
- `SecureStorage` is available for client-side use cases.
- Vector and Relational storage abstractions are planned but not yet implemented.

## Further Reading

Dive deeper into specific storage aspects:

- [Storage Abstraction Layer (Roadmap)](../roadmap/storage-abstraction.md)
- [Vector Storage Integration (Roadmap)](../roadmap/vector-storage.md)
- [Advanced Memory Systems (Roadmap)](../roadmap/advanced-memory.md)
- [Session Management](../architecture/sessions/session-management.md) (Details usage of storage)
