/**
 * @fileoverview ConnectionGraph - Memory connection graph management
 *
 * Manages a graph of memory connections with efficient traversal and analysis.
 * Language-agnostic graph operations focusing on relationships, not content.
 *
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../../logging';
import { ConnectionType, MemoryConnection } from '../../../storage/types';
import { Memory } from '../../types/common';

/**
 * Graph configuration for traversal and analysis
 */
interface GraphConfig {
  maxDepth: number;
  maxConnections: number;
  strengthThreshold: number;
}

/**
 * Graph statistics for analysis
 */
interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  strongestConnection: number;
  weakestConnection: number;
  connectedComponents: number;
}

/**
 * Connection graph for managing memory relationships
 */
export class ConnectionGraph {
  private nodes: Map<string, Memory>;
  private edges: Map<string, MemoryConnection[]>;
  private incomingEdges: Map<string, MemoryConnection[]>;

  private defaultConfig: GraphConfig = {
    maxDepth: 5,
    maxConnections: 50,
    strengthThreshold: 0.3
  };

  constructor(private config: Partial<GraphConfig> = {}) {
    this.nodes = new Map();
    this.edges = new Map();
    this.incomingEdges = new Map();
    this.config = { ...this.defaultConfig, ...config };

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Initialized connection graph',
      this.config
    );
  }

  /**
   * Add a memory node to the graph
   */
  addNode(memory: Memory): void {
    this.nodes.set(memory.id, memory);

    if (!this.edges.has(memory.id)) {
      this.edges.set(memory.id, []);
    }

    if (!this.incomingEdges.has(memory.id)) {
      this.incomingEdges.set(memory.id, []);
    }

    logger.debug(LogCategory.STORAGE, 'ConnectionGraph', 'Added memory node', {
      memoryId: memory.id,
      nodeCount: this.nodes.size
    });
  }

  /**
   * Add a connection edge to the graph
   */
  addEdge(connection: MemoryConnection): void {
    // Validate nodes exist
    if (
      !this.nodes.has(connection.sourceMemoryId) ||
      !this.nodes.has(connection.targetMemoryId)
    ) {
      logger.warn(
        LogCategory.STORAGE,
        'ConnectionGraph',
        'Cannot add edge - missing nodes',
        {
          sourceExists: this.nodes.has(connection.sourceMemoryId),
          targetExists: this.nodes.has(connection.targetMemoryId),
          sourceMemoryId: connection.sourceMemoryId,
          targetMemoryId: connection.targetMemoryId
        }
      );
      return;
    }

    // Filter by strength threshold
    if (connection.strength < this.config.strengthThreshold!) {
      return;
    }

    // Add to outgoing edges
    const outgoing = this.edges.get(connection.sourceMemoryId) || [];
    outgoing.push(connection);
    this.edges.set(connection.sourceMemoryId, outgoing);

    // Add to incoming edges
    const incoming = this.incomingEdges.get(connection.targetMemoryId) || [];
    incoming.push(connection);
    this.incomingEdges.set(connection.targetMemoryId, incoming);

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Added connection edge',
      {
        sourceMemoryId: connection.sourceMemoryId,
        targetMemoryId: connection.targetMemoryId,
        connectionType: connection.connectionType,
        strength: connection.strength
      }
    );
  }

  /**
   * Find path between two memories using BFS
   */
  findPath(sourceId: string, targetId: string): string[] {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return [];
    }

    if (sourceId === targetId) {
      return [sourceId];
    }

    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [
      { id: sourceId, path: [sourceId] }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id)) {
        continue;
      }

      visited.add(current.id);

      // Check if we've reached max depth
      if (current.path.length >= this.config.maxDepth!) {
        continue;
      }

      // Get neighbors
      const neighbors = this.getDirectNeighbors(current.id);

      for (const neighbor of neighbors) {
        if (neighbor.targetMemoryId === targetId) {
          return [...current.path, targetId];
        }

        if (!visited.has(neighbor.targetMemoryId)) {
          queue.push({
            id: neighbor.targetMemoryId,
            path: [...current.path, neighbor.targetMemoryId]
          });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Get direct neighbors of a memory (both incoming and outgoing)
   */
  getNeighbors(memoryId: string, type?: ConnectionType): MemoryConnection[] {
    const outgoing = this.edges.get(memoryId) || [];
    const incoming = this.incomingEdges.get(memoryId) || [];

    let allConnections = [...outgoing, ...incoming];

    if (type) {
      allConnections = allConnections.filter(
        (conn) => conn.connectionType === type
      );
    }

    // Sort by strength descending
    return allConnections
      .sort((a, b) => b.strength - a.strength)
      .slice(0, this.config.maxConnections);
  }

  /**
   * Get only outgoing connections
   */
  private getDirectNeighbors(memoryId: string): MemoryConnection[] {
    return this.edges.get(memoryId) || [];
  }

  /**
   * Find clusters of highly connected memories using DFS
   */
  getClusters(): string[][] {
    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const nodeId of Array.from(this.nodes.keys())) {
      if (!visited.has(nodeId)) {
        const cluster = this.dfsCluster(nodeId, visited);
        if (cluster.length > 1) {
          // Only return clusters with multiple nodes
          clusters.push(cluster);
        }
      }
    }

    // Sort clusters by size (largest first)
    return clusters.sort((a, b) => b.length - a.length);
  }

  /**
   * DFS to find connected component cluster
   */
  private dfsCluster(startId: string, visited: Set<string>): string[] {
    const cluster: string[] = [];
    const stack: string[] = [startId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      cluster.push(currentId);

      // Add all connected neighbors to stack
      const neighbors = this.getDirectNeighbors(currentId);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.targetMemoryId)) {
          stack.push(neighbor.targetMemoryId);
        }
      }

      // Also check incoming connections
      const incoming = this.incomingEdges.get(currentId) || [];
      for (const connection of incoming) {
        if (!visited.has(connection.sourceMemoryId)) {
          stack.push(connection.sourceMemoryId);
        }
      }
    }

    return cluster;
  }

  /**
   * Find the most central memories in the graph
   */
  findCentralMemories(
    limit: number = 10
  ): Array<{ memoryId: string; centrality: number }> {
    const centralities: Array<{ memoryId: string; centrality: number }> = [];

    for (const nodeId of Array.from(this.nodes.keys())) {
      const centrality = this.calculateCentrality(nodeId);
      centralities.push({ memoryId: nodeId, centrality });
    }

    return centralities
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, limit);
  }

  /**
   * Calculate degree centrality for a node
   */
  private calculateCentrality(nodeId: string): number {
    const outgoing = this.edges.get(nodeId) || [];
    const incoming = this.incomingEdges.get(nodeId) || [];

    // Weighted degree centrality (sum of connection strengths)
    const outgoingStrength = outgoing.reduce(
      (sum, conn) => sum + conn.strength,
      0
    );
    const incomingStrength = incoming.reduce(
      (sum, conn) => sum + conn.strength,
      0
    );

    return outgoingStrength + incomingStrength;
  }

  /**
   * Get graph statistics
   */
  getStats(): GraphStats {
    const nodeCount = this.nodes.size;
    let edgeCount = 0;
    let totalStrength = 0;
    let minStrength = 1;
    let maxStrength = 0;

    for (const connections of Array.from(this.edges.values())) {
      edgeCount += connections.length;
      for (const conn of connections) {
        totalStrength += conn.strength;
        minStrength = Math.min(minStrength, conn.strength);
        maxStrength = Math.max(maxStrength, conn.strength);
      }
    }

    const averageDegree = nodeCount > 0 ? edgeCount / nodeCount : 0;
    const clusters = this.getClusters();

    return {
      nodeCount,
      edgeCount,
      averageDegree,
      strongestConnection: maxStrength,
      weakestConnection: minStrength,
      connectedComponents: clusters.length
    };
  }

  /**
   * Remove a memory and all its connections
   */
  removeNode(memoryId: string): void {
    // Remove the node
    this.nodes.delete(memoryId);

    // Remove all outgoing connections
    this.edges.delete(memoryId);

    // Remove all incoming connections
    this.incomingEdges.delete(memoryId);

    // Remove references from other nodes
    for (const [nodeId, connections] of Array.from(this.edges.entries())) {
      const filtered = connections.filter(
        (conn) => conn.targetMemoryId !== memoryId
      );
      this.edges.set(nodeId, filtered);
    }

    for (const [nodeId, connections] of Array.from(
      this.incomingEdges.entries()
    )) {
      const filtered = connections.filter(
        (conn) => conn.sourceMemoryId !== memoryId
      );
      this.incomingEdges.set(nodeId, filtered);
    }

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Removed memory node and connections',
      { memoryId, remainingNodes: this.nodes.size }
    );
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.incomingEdges.clear();

    logger.debug(
      LogCategory.STORAGE,
      'ConnectionGraph',
      'Cleared entire graph'
    );
  }

  /**
   * Get memory by ID
   */
  getMemory(memoryId: string): Memory | undefined {
    return this.nodes.get(memoryId);
  }

  /**
   * Check if memory exists in graph
   */
  hasMemory(memoryId: string): boolean {
    return this.nodes.has(memoryId);
  }

  /**
   * Get all memory IDs in the graph
   */
  getAllMemoryIds(): string[] {
    return Array.from(this.nodes.keys());
  }
}
