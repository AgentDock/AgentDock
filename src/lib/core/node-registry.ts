import { BaseNode } from './base-node';
import { NodeMeta } from '../types/flow';
import semver from 'semver';

// Using any here is intentional as nodes can accept arbitrary data types
type NodeConstructor<T = any> = new (
    id: string,
    data: T,
    version?: string,
    meta?: NodeMeta
) => BaseNode<T>;

type VersionedNode = {
    constructor: NodeConstructor;
    version: string;
    meta?: NodeMeta;
};

export class NodeRegistry {
    private static instance: NodeRegistry;
    private nodes: Map<string, VersionedNode> = new Map();

    private constructor() {}

    static getInstance(): NodeRegistry {
        if (!NodeRegistry.instance) {
            NodeRegistry.instance = new NodeRegistry();
        }
        return NodeRegistry.instance;
    }

    // Register a node type with version
    register<T>(
        type: string,
        constructor: NodeConstructor<T>,
        version: string,
        meta?: NodeMeta
    ): void {
        if (!semver.valid(version)) {
            throw new Error(`Invalid version format: ${version}`);
        }

        this.nodes.set(type, { constructor, version, meta });
    }

    // Create a node instance with version compatibility check
    create<T>(
        type: string,
        id: string,
        data: T,
        version?: string,
        meta?: NodeMeta
    ): BaseNode<T> {
        const nodeInfo = this.nodes.get(type);
        if (!nodeInfo) {
            throw new Error(`Unknown node type: ${type}`);
        }

        // Version compatibility check
        if (version && !this.isVersionCompatible(nodeInfo.version, version)) {
            throw new Error(
                `Version mismatch: Node requires ${nodeInfo.version}, but ${version} was provided`
            );
        }

        // Merge registered metadata with instance metadata
        const mergedMeta = {
            ...nodeInfo.meta,
            ...meta
        };

        return new nodeInfo.constructor(
            id,
            data,
            version || nodeInfo.version,
            mergedMeta
        );
    }

    // Check if a node type exists
    has(type: string): boolean {
        return this.nodes.has(type);
    }

    // Get metadata for a node type
    getMeta(type: string): NodeMeta | undefined {
        return this.nodes.get(type)?.meta;
    }

    // Get version for a node type
    getVersion(type: string): string | undefined {
        return this.nodes.get(type)?.version;
    }

    // Get all registered node types
    getTypes(): string[] {
        return Array.from(this.nodes.keys());
    }

    // Version compatibility check
    private isVersionCompatible(required: string, provided: string): boolean {
        // Major version must match exactly
        // Minor and patch can be greater or equal
        return semver.satisfies(provided, `${semver.major(required)}.x.x`);
    }

    // Clear registry (mainly for testing)
    clear(): void {
        this.nodes.clear();
    }
} 