/**
 * @fileoverview ConnectionGraph - Graph algorithms for memory relationships
 *
 * Provides graph traversal, pathfinding, and analysis capabilities
 * for the memory connection network.
 *
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../../logging';
import { Memory } from '../../types/common';
import { ConnectionType, MemoryConnection } from '../types';

/**
 * Graph node representing a memory with its connections
 */
export interface MemoryNode {
  memory: Memory;
  connections: MemoryConnection[];
  depth: number;
}

/**
 * Graph traversal options
 */
export interface TraversalOptions {
  maxDepth: number;
  connectionTypes?: ConnectionType[];
  minStrength?: number;
  includeMetadata?: boolean;
}

/**
 * Graph insights and statistics
 */
export interface GraphInsights {
  totalNodes: number;
  totalConnections: number;
  averageConnections: number;
  maxConnections: number;
  mostConnectedMemory: string;
  strongestConnection: MemoryConnection | null;
  clusters: Array<{
    size: number;
    members: string[];
    avgStrength: number;
  }>;
}

/**
 * Graph algorithms for memory connection networks
 */
export class ConnectionGraph {
  constructor(private storage: any) {}

  /**
   * Find connected memories using graph traversal
   */
  async findConnectedMemories(
    memoryId: string,
    options: TraversalOptions = { maxDepth: 3 }
  ): Promise<MemoryNode[]> {
    try {
      logger.debug(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Finding connected memories',
        {
          memoryId,
          maxDepth: options.maxDepth,
          connectionTypes: options.connectionTypes
        }
      );

      const visited = new Set<string>();
      const nodes: MemoryNode[] = [];
      const queue: Array<{ id: string; depth: number }> = [
        { id: memoryId, depth: 0 }
      ];

      while (queue.length > 0 && nodes.length < 100) {
        // Safety limit
        const { id, depth } = queue.shift()!;

        if (visited.has(id) || depth > options.maxDepth) {
          continue;
        }

        visited.add(id);

        // Get memory and its connections
        const { memory, connections } = await this.getMemoryWithConnections(id);

        if (!memory) continue;

        // Filter connections based on options
        const filteredConnections = this.filterConnections(
          connections,
          options
        );

        nodes.push({
          memory,
          connections: filteredConnections,
          depth
        });

        // Add connected memories to queue
        if (depth < options.maxDepth) {
          for (const connection of filteredConnections) {
            const nextId =
              connection.sourceId === id
                ? connection.targetId
                : connection.sourceId;

            if (!visited.has(nextId)) {
              queue.push({ id: nextId, depth: depth + 1 });
            }
          }
        }
      }

      logger.info(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Found connected memories',
        {
          memoryId,
          totalFound: nodes.length,
          maxDepthReached: Math.max(...nodes.map((n) => n.depth))
        }
      );

      return nodes;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Error finding connected memories',
        {
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Find the shortest path between two memories
   */
  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<string[]> {
    if (sourceId === targetId) return [sourceId];

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [
      { id: sourceId, path: [sourceId] }
    ];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (path.length > maxDepth) continue;
      if (visited.has(id)) continue;

      visited.add(id);

      // Get connections for current memory
      const { connections } = await this.getMemoryWithConnections(id);

      for (const connection of connections) {
        const nextId =
          connection.sourceId === id
            ? connection.targetId
            : connection.sourceId;

        if (nextId === targetId) {
          return [...path, nextId];
        }

        if (!visited.has(nextId)) {
          queue.push({ id: nextId, path: [...path, nextId] });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Get graph insights and statistics for an agent
   */
  async getGraphInsights(agentId: string): Promise<GraphInsights> {
    try {
      // Get all memories and connections for the agent
      const allConnections = await this.getAllConnections(agentId);
      const memoryConnectionCounts = new Map<string, number>();
      let totalStrength = 0;
      let strongestConnection: MemoryConnection | null = null;
      let maxStrength = 0;

      // Analyze connections
      for (const connection of allConnections) {
        // Count connections per memory
        memoryConnectionCounts.set(
          connection.sourceId,
          (memoryConnectionCounts.get(connection.sourceId) || 0) + 1
        );
        memoryConnectionCounts.set(
          connection.targetId,
          (memoryConnectionCounts.get(connection.targetId) || 0) + 1
        );

        // Track strength statistics
        totalStrength += connection.strength;
        if (connection.strength > maxStrength) {
          maxStrength = connection.strength;
          strongestConnection = connection;
        }
      }

      const totalNodes = memoryConnectionCounts.size;
      const totalConnections = allConnections.length;
      const averageConnections =
        totalNodes > 0 ? totalConnections / totalNodes : 0;

      // Find most connected memory
      let mostConnectedMemory = '';
      let maxConnections = 0;
      for (const entry of Array.from(memoryConnectionCounts.entries())) {
        const [memoryId, count] = entry;
        if (count > maxConnections) {
          maxConnections = count;
          mostConnectedMemory = memoryId;
        }
      }

      // Find clusters (simplified version)
      const clusters = await this.findClusters(allConnections);

      const insights: GraphInsights = {
        totalNodes,
        totalConnections,
        averageConnections,
        maxConnections,
        mostConnectedMemory,
        strongestConnection,
        clusters
      };

      logger.info(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Generated graph insights',
        {
          agentId: agentId.substring(0, 8),
          totalNodes,
          totalConnections,
          clusters: clusters.length
        }
      );

      return insights;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Error generating graph insights',
        {
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Get memory with its connections from storage
   */
  private async getMemoryWithConnections(memoryId: string): Promise<{
    memory: Memory | null;
    connections: MemoryConnection[];
  }> {
    const memory = (await this.storage.get(
      `memory:${memoryId}`
    )) as Memory | null;
    const connections = await this.getConnectionsForMemory(memoryId);

    return { memory, connections };
  }

  /**
   * Get all connections for a memory
   */
  private async getConnectionsForMemory(
    memoryId: string
  ): Promise<MemoryConnection[]> {
    try {
      const connections: MemoryConnection[] = [];
      const keys = await this.storage.list(`connection:${memoryId}:`);

      for (const key of keys) {
        const connection = (await this.storage.get(
          key
        )) as MemoryConnection | null;
        if (connection) {
          connections.push(connection);
        }
      }

      return connections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all connections for an agent
   */
  private async getAllConnections(
    agentId: string
  ): Promise<MemoryConnection[]> {
    const connections: MemoryConnection[] = [];

    // Use the standard connection storage pattern
    const connectionKeys = await this.storage.list(`connection:${agentId}:`);

    for (const key of connectionKeys) {
      const connection = (await this.storage.get(
        key
      )) as MemoryConnection | null;
      if (connection) {
        connections.push(connection);
      }
    }

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Retrieved agent connections',
      {
        agentId: agentId.substring(0, 8),
        connectionCount: connections.length
      }
    );

    return connections;
  }

  /**
   * Filter connections based on options
   */
  private filterConnections(
    connections: MemoryConnection[],
    options: TraversalOptions
  ): MemoryConnection[] {
    let filtered = connections;

    // Filter by connection types
    if (options.connectionTypes && options.connectionTypes.length > 0) {
      filtered = filtered.filter((c) =>
        options.connectionTypes!.includes(c.type)
      );
    }

    // Filter by minimum strength
    if (options.minStrength !== undefined) {
      filtered = filtered.filter((c) => c.strength >= options.minStrength!);
    }

    return filtered;
  }

  /**
   * Find clusters in the connection graph using connected components algorithm
   */
  private async findClusters(connections: MemoryConnection[]): Promise<
    Array<{
      size: number;
      members: string[];
      avgStrength: number;
    }>
  > {
    const clusters: Array<{
      size: number;
      members: string[];
      avgStrength: number;
    }> = [];

    if (connections.length === 0) {
      return clusters;
    }

    // Build adjacency list from connections
    const adjacencyList = new Map<string, Set<string>>();
    const connectionStrengths = new Map<string, number[]>();

    for (const connection of connections) {
      // Add nodes to adjacency list
      if (!adjacencyList.has(connection.sourceId)) {
        adjacencyList.set(connection.sourceId, new Set());
        connectionStrengths.set(connection.sourceId, []);
      }
      if (!adjacencyList.has(connection.targetId)) {
        adjacencyList.set(connection.targetId, new Set());
        connectionStrengths.set(connection.targetId, []);
      }

      // Add edges (bidirectional for undirected graph)
      adjacencyList.get(connection.sourceId)!.add(connection.targetId);
      adjacencyList.get(connection.targetId)!.add(connection.sourceId);

      // Track connection strengths for each node
      connectionStrengths.get(connection.sourceId)!.push(connection.strength);
      connectionStrengths.get(connection.targetId)!.push(connection.strength);
    }

    // Find connected components using DFS
    const visited = new Set<string>();
    const allNodes = Array.from(adjacencyList.keys());

    for (const startNode of allNodes) {
      if (visited.has(startNode)) {
        continue;
      }

      // DFS to find all nodes in this component
      const component: string[] = [];
      const stack = [startNode];
      let totalStrength = 0;
      let strengthCount = 0;

      while (stack.length > 0) {
        const node = stack.pop()!;

        if (visited.has(node)) {
          continue;
        }

        visited.add(node);
        component.push(node);

        // Calculate total strength for this node
        const nodeStrengths = connectionStrengths.get(node) || [];
        totalStrength += nodeStrengths.reduce(
          (sum, strength) => sum + strength,
          0
        );
        strengthCount += nodeStrengths.length;

        // Add unvisited neighbors to stack
        const neighbors = adjacencyList.get(node) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }

      // Only include clusters with multiple nodes
      if (component.length > 1) {
        const avgStrength =
          strengthCount > 0 ? totalStrength / strengthCount : 0;

        clusters.push({
          size: component.length,
          members: component.sort(), // Sort for consistency
          avgStrength: Math.round(avgStrength * 1000) / 1000 // Round to 3 decimal places
        });
      }
    }

    // Sort clusters by size (largest first)
    clusters.sort((a, b) => b.size - a.size);

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Found memory clusters',
      {
        totalClusters: clusters.length,
        largestCluster: clusters.length > 0 ? clusters[0].size : 0,
        totalNodes: allNodes.length
      }
    );

    return clusters;
  }
}
