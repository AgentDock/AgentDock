import { Tool } from 'ai';
import { z } from 'zod';

import { createMockBaseNode } from '../../test/setup';
import { NodeCategory } from '../../types/node-category';
import { NodeMetadata } from '../base-node';
import { getToolRegistry } from '../tool-registry';

// Mock Tool interface for testing
interface MockTool {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  execute: jest.Mock<Promise<any>>;
  _testMetadata?: { allowedNodeIds?: string[]; deniedNodeIds?: string[] };
}

describe('ToolRegistry (via getToolRegistry singleton)', () => {
  let mockTool1: MockTool;
  let mockTool2: MockTool;
  const toolRegistry = getToolRegistry();

  // Clear registry before each test suite description block, not each test
  beforeAll(() => {
    // Clear the tools from the registry instance directly if possible
    // Assuming an internal structure like _tools or tools
    // This is a bit of a hack, ideally there'd be a clear() method
    if ((toolRegistry as any).tools) {
      (toolRegistry as any).tools = {};
    } else if ((toolRegistry as any)._tools) {
      (toolRegistry as any)._tools = {};
    } else {
      console.warn(
        'Could not find internal tools map to clear in ToolRegistry test setup.'
      );
    }
  });

  beforeEach(() => {
    // Re-define mocks for each test to ensure isolation
    mockTool1 = {
      name: 'tool1',
      description: 'First test tool',
      parameters: z.object({ input: z.string() }),
      execute: jest.fn().mockResolvedValue('result1'),
      _testMetadata: { allowedNodeIds: ['agent1'] }
    };

    mockTool2 = {
      name: 'tool2',
      description: 'Second test tool',
      parameters: z.object({ value: z.number() }),
      execute: jest.fn().mockResolvedValue('result2'),
      _testMetadata: { deniedNodeIds: ['agent1'] }
    };

    // Clear mocks specifically
    mockTool1.execute.mockClear();
    mockTool2.execute.mockClear();

    // Register tools needed for most tests *here* within beforeEach
    // Ensure this happens *after* mocks are defined and *before* each test
    toolRegistry.registerTool(mockTool1.name, mockTool1);
    toolRegistry.registerTool(mockTool2.name, mockTool2);
    toolRegistry.registerTool('tool3', {
      name: 'tool3',
      description: 'Tool 3',
      parameters: z.object({}),
      execute: jest.fn()
    });
  });

  describe('registerTool', () => {
    it('should register a new tool successfully', () => {
      toolRegistry.registerTool(mockTool1.name, mockTool1);
      const registeredTool = (toolRegistry as any).tools?.[mockTool1.name];
      expect(registeredTool).toBe(mockTool1);
    });

    it('should overwrite tool if registering a duplicate tool name (no warning expected based on source)', () => {
      const updatedMockTool1: MockTool = {
        ...mockTool1,
        description: 'Updated Tool 1'
      };

      toolRegistry.registerTool(mockTool1.name, mockTool1);
      toolRegistry.registerTool(updatedMockTool1.name, updatedMockTool1);

      const registeredTool = (toolRegistry as any).tools?.[mockTool1.name];
      expect(registeredTool).toBe(updatedMockTool1);
    });
  });

  // --- Testing getToolsForAgent ---
  describe('getToolsForAgent', () => {
    it('should return an empty object if nodeNames array is empty', () => {
      let tools = toolRegistry.getToolsForAgent([]);
      expect(Object.keys(tools)).toHaveLength(0); // Expect 0 tools
    });

    it('should return only the tools explicitly requested by name if they exist', () => {
      const agentTools = toolRegistry.getToolsForAgent([
        'tool1',
        'tool3',
        'non-existent-tool'
      ]);
      expect(Object.keys(agentTools)).toHaveLength(2);
      expect(agentTools['tool1']).toBeDefined();
      expect(agentTools['tool3']).toBeDefined();
      expect(agentTools['non-existent-tool']).toBeUndefined();
    });

    it('should return an empty object if requested tools do not exist', () => {
      const agentTools = toolRegistry.getToolsForAgent([
        'agent2',
        'another-tool'
      ]);
      expect(Object.keys(agentTools)).toHaveLength(0);
    });

    it('should return a copy of the tool with name matching the key', () => {
      const originalTool = {
        name: 'originalName',
        description: 'Test',
        parameters: z.object({}),
        execute: jest.fn()
      };
      toolRegistry.registerTool('registeredKey', originalTool);
      const agentTools = toolRegistry.getToolsForAgent(['registeredKey']);
      expect(agentTools['registeredKey']).toBeDefined();
      expect(agentTools['registeredKey'].name).toBe('registeredKey');
      expect(agentTools['registeredKey'].description).toBe('Test');
      expect(agentTools['registeredKey']).not.toBe(originalTool);
    });
  });
});
