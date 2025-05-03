import { OrchestrationManager } from '../index';
import { OrchestrationStateManager } from '../state';
import { StepSequencer } from '../sequencer';
import { SessionId } from '../../types/session';
import { OrchestrationConfig, OrchestrationStep, AIOrchestrationState } from '../../types/orchestration';
import { LLMMessage } from '../../llm/types';
import { createMockStorageProvider } from '../../test/setup';
import { logger } from '../../logging';

jest.mock('../../logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    ORCHESTRATION: 'orchestration'
  }
}));

jest.mock('../state', () => {
  const originalModule = jest.requireActual('../state');
  return {
    ...originalModule,
    createOrchestrationStateManager: jest.fn().mockImplementation(() => ({
      getState: jest.fn(),
      getOrCreateState: jest.fn(),
      updateState: jest.fn(),
      setActiveStep: jest.fn(),
      addUsedTool: jest.fn(),
      advanceSequence: jest.fn(),
      resetState: jest.fn(),
      cleanupSession: jest.fn(),
      toAIOrchestrationState: jest.fn()
    })),
    OrchestrationStateManager: jest.fn().mockImplementation(() => ({
      getState: jest.fn(),
      getOrCreateState: jest.fn(),
      updateState: jest.fn(),
      setActiveStep: jest.fn(),
      addUsedTool: jest.fn(),
      advanceSequence: jest.fn(),
      resetState: jest.fn(),
      cleanupSession: jest.fn(),
      toAIOrchestrationState: jest.fn()
    }))
  };
});

jest.mock('../sequencer', () => {
  const originalModule = jest.requireActual('../sequencer');
  return {
    ...originalModule,
    createStepSequencer: jest.fn().mockImplementation(() => ({
      hasActiveSequence: jest.fn(),
      getCurrentSequenceTool: jest.fn(),
      advanceSequence: jest.fn(),
      processTool: jest.fn(),
      filterToolsBySequence: jest.fn()
    })),
    StepSequencer: jest.fn().mockImplementation(() => ({
      hasActiveSequence: jest.fn(),
      getCurrentSequenceTool: jest.fn(),
      advanceSequence: jest.fn(),
      processTool: jest.fn(),
      filterToolsBySequence: jest.fn()
    }))
  };
});

describe('OrchestrationManager', () => {
  let manager: OrchestrationManager;
  let mockStateManager: jest.Mocked<OrchestrationStateManager>;
  let mockSequencer: jest.Mocked<StepSequencer>;
  let mockStorageProvider: ReturnType<typeof createMockStorageProvider>;
  const sessionId: SessionId = 'test-session-id';
  
  const testOrchestration: OrchestrationConfig = {
    steps: [
      {
        name: 'default-step',
        description: 'Default step for testing',
        isDefault: true
      },
      {
        name: 'conditional-step',
        description: 'Step with conditions',
        conditions: [
          { type: 'tool_used', value: 'test-tool' }
        ],
        isDefault: false
      },
      {
        name: 'sequence-step',
        description: 'Step with sequence',
        sequence: ['tool1', 'tool2', 'tool3'],
        isDefault: false,
        conditions: [
          { type: 'sequence_match' }
        ]
      },
      {
        name: 'allowed-tools-step',
        description: 'Step with allowed tools',
        availableTools: {
          allowed: ['allowed-tool-1', 'allowed-tool-2']
        },
        isDefault: false
      },
      {
        name: 'denied-tools-step',
        description: 'Step with denied tools',
        availableTools: {
          denied: ['denied-tool-1', 'denied-tool-2']
        },
        isDefault: false
      }
    ]
  };
  
  const testMessages: LLMMessage[] = [
    { role: 'user', content: 'Test message' }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorageProvider = createMockStorageProvider();
    
    manager = new OrchestrationManager({
      storageProvider: mockStorageProvider,
      storageNamespace: 'test-namespace'
    });
    
    mockStateManager = (manager as any).stateManager;
    mockSequencer = (manager as any).sequencer;
  });
  
  describe('ensureStateExists', () => {
    it('should call stateManager.getOrCreateState and return the result', async () => {
      const mockState = {
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const result = await manager.ensureStateExists(sessionId);
      
      expect(result).toEqual(mockState);
      expect(mockStateManager.getOrCreateState).toHaveBeenCalledWith(sessionId);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should return null and log error if stateManager.getOrCreateState throws', async () => {
      const error = new Error('Failed to create state');
      
      mockStateManager.getOrCreateState.mockRejectedValueOnce(error);
      
      const result = await manager.ensureStateExists(sessionId);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getActiveStep', () => {
    it('should return undefined if no orchestration steps are provided', async () => {
      const result = await manager.getActiveStep({ steps: [] }, testMessages, sessionId);
      
      expect(result).toBeUndefined();
    });
    
    it('should get or create state and return undefined if state creation fails', async () => {
      mockStateManager.getOrCreateState.mockResolvedValueOnce(null);
      
      const result = await manager.getActiveStep(testOrchestration, testMessages, sessionId);
      
      expect(result).toBeUndefined();
      expect(mockStateManager.getOrCreateState).toHaveBeenCalledWith(sessionId);
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should return step with all conditions met', async () => {
      const mockState = {
        sessionId,
        recentlyUsedTools: ['test-tool'],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const result = await manager.getActiveStep(testOrchestration, testMessages, sessionId);
      
      expect(result).toEqual(testOrchestration.steps[1]); // conditional-step
      expect(mockStateManager.updateState).toHaveBeenCalledWith(
        sessionId,
        { activeStep: 'conditional-step', sequenceIndex: 0 }
      );
    });
    
    it('should return current active step if no conditions are met', async () => {
      const mockState = {
        sessionId,
        activeStep: 'default-step',
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const result = await manager.getActiveStep(testOrchestration, testMessages, sessionId);
      
      expect(result).toEqual(testOrchestration.steps[0]); // default-step
      expect(mockStateManager.updateState).not.toHaveBeenCalled();
    });
    
    it('should return default step if current step is not in config', async () => {
      const mockState = {
        sessionId,
        activeStep: 'non-existent-step',
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const result = await manager.getActiveStep(testOrchestration, testMessages, sessionId);
      
      expect(result).toEqual(testOrchestration.steps[0]); // default-step
      expect(mockStateManager.updateState).toHaveBeenCalledWith(
        sessionId,
        { activeStep: 'default-step', sequenceIndex: 0 }
      );
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should return undefined if no default step is found', async () => {
      const mockState = {
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const noDefaultOrchestration: OrchestrationConfig = {
        steps: [
          {
            name: 'non-default-step',
            description: 'Non-default step',
            isDefault: false
          }
        ]
      };
      
      const result = await manager.getActiveStep(noDefaultOrchestration, testMessages, sessionId);
      
      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should check sequence_match condition correctly', async () => {
      const mockState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2', 'tool3'], // Matches sequence
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const result = await manager.getActiveStep(testOrchestration, testMessages, sessionId);
      
      expect(result).toEqual(testOrchestration.steps[2]); // sequence-step
      expect(mockStateManager.updateState).toHaveBeenCalledWith(
        sessionId,
        { activeStep: 'sequence-step', sequenceIndex: 0 }
      );
    });
    
    it('should log warning for unsupported condition type', async () => {
      const mockState = {
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.getOrCreateState.mockResolvedValueOnce(mockState);
      
      const unsupportedConditionOrchestration: OrchestrationConfig = {
        steps: [
          {
            name: 'unsupported-condition-step',
            description: 'Step with unsupported condition',
            conditions: [
              { type: 'unsupported_type' as any, value: 'test' }
            ],
            isDefault: false
          },
          {
            name: 'default-step',
            description: 'Default step',
            isDefault: true
          }
        ]
      };
      
      const result = await manager.getActiveStep(unsupportedConditionOrchestration, testMessages, sessionId);
      
      expect(result).toEqual(unsupportedConditionOrchestration.steps[1]); // default-step
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('checkCondition', () => {
    it('should return true for tool_used condition when tool is in history', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'test-tool', 'tool3'] };
      const condition = { type: 'tool_used', value: 'test-tool' };
      const step = testOrchestration.steps[1]; // conditional-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(true);
    });
    
    it('should return false for tool_used condition when tool is not in history', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'tool2', 'tool3'] };
      const condition = { type: 'tool_used', value: 'test-tool' };
      const step = testOrchestration.steps[1]; // conditional-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
    });
    
    it('should return false for tool_used condition with undefined value', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'tool2', 'tool3'] };
      const condition = { type: 'tool_used', value: undefined as any };
      const step = testOrchestration.steps[1]; // conditional-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
    });
    
    it('should return true for sequence_match condition when history ends with sequence', () => {
      const toolContext = { recentlyUsedTools: ['other-tool', 'tool1', 'tool2', 'tool3'] };
      const condition = { type: 'sequence_match' };
      const step = testOrchestration.steps[2]; // sequence-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should return false for sequence_match condition when history does not end with sequence', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'tool2', 'other-tool'] };
      const condition = { type: 'sequence_match' };
      const step = testOrchestration.steps[2]; // sequence-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
    });
    
    it('should return false for sequence_match condition when step has no sequence', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'tool2', 'tool3'] };
      const condition = { type: 'sequence_match' };
      const step = testOrchestration.steps[0]; // default-step (no sequence)
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should return false for sequence_match condition when history is too short', () => {
      const toolContext = { recentlyUsedTools: ['tool2', 'tool3'] }; // Only 2 tools, sequence has 3
      const condition = { type: 'sequence_match' };
      const step = testOrchestration.steps[2]; // sequence-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
    });
    
    it('should return false for unsupported condition type', () => {
      const toolContext = { recentlyUsedTools: ['tool1', 'tool2', 'tool3'] };
      const condition = { type: 'unsupported_type' as any, value: 'test' };
      const step = testOrchestration.steps[0]; // default-step
      
      const result = (manager as any).checkCondition(condition, toolContext, step);
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should handle undefined toolContext', () => {
      const condition = { type: 'tool_used', value: 'test-tool' };
      const step = testOrchestration.steps[1]; // conditional-step
      
      const result = (manager as any).checkCondition(condition, undefined, step);
      
      expect(result).toBe(false);
    });
  });
  
  describe('getAllowedTools', () => {
    it('should return all tools if no orchestration steps are provided', async () => {
      const allToolIds = ['tool1', 'tool2', 'tool3'];
      
      const result = await manager.getAllowedTools({ steps: [] }, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(allToolIds);
    });
    
    it('should return all tools if no active step is found', async () => {
      const allToolIds = ['tool1', 'tool2', 'tool3'];
      
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(undefined);
      
      const result = await manager.getAllowedTools(testOrchestration, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(allToolIds);
      expect(manager.getActiveStep).toHaveBeenCalledWith(testOrchestration, testMessages, sessionId);
    });
    
    it('should call sequencer.filterToolsBySequence if step has sequence', async () => {
      const allToolIds = ['tool1', 'tool2', 'tool3', 'tool4'];
      const filteredTools = ['tool2']; // Assuming we're at sequence index 1
      
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(testOrchestration.steps[2]);
      
      mockSequencer.filterToolsBySequence.mockResolvedValueOnce(filteredTools);
      
      const result = await manager.getAllowedTools(testOrchestration, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(filteredTools);
      expect(mockSequencer.filterToolsBySequence).toHaveBeenCalledWith(
        testOrchestration.steps[2],
        sessionId,
        allToolIds
      );
    });
    
    it('should filter tools based on allowed list', async () => {
      const allToolIds = ['tool1', 'allowed-tool-1', 'allowed-tool-2', 'tool4'];
      
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(testOrchestration.steps[3]);
      
      const result = await manager.getAllowedTools(testOrchestration, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(['allowed-tool-1', 'allowed-tool-2']);
    });
    
    it('should filter tools based on denied list', async () => {
      const allToolIds = ['tool1', 'denied-tool-1', 'denied-tool-2', 'tool4'];
      
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(testOrchestration.steps[4]);
      
      const result = await manager.getAllowedTools(testOrchestration, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(['tool1', 'tool4']);
    });
    
    it('should return all tools if step has no filtering rules', async () => {
      const allToolIds = ['tool1', 'tool2', 'tool3'];
      
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(testOrchestration.steps[0]);
      
      const result = await manager.getAllowedTools(testOrchestration, testMessages, sessionId, allToolIds);
      
      expect(result).toEqual(allToolIds);
    });
  });
  
  describe('processToolUsage', () => {
    it('should do nothing if no active step is found', async () => {
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(undefined);
      
      await manager.processToolUsage(testOrchestration, testMessages, sessionId, 'test-tool');
      
      expect(mockSequencer.processTool).not.toHaveBeenCalled();
      expect(manager.getActiveStep).toHaveBeenCalledTimes(1);
    });
    
    it('should call sequencer.processTool and re-evaluate active step', async () => {
      jest.spyOn(manager, 'getActiveStep').mockResolvedValueOnce(testOrchestration.steps[2]);
      
      await manager.processToolUsage(testOrchestration, testMessages, sessionId, 'test-tool');
      
      expect(mockSequencer.processTool).toHaveBeenCalledWith(
        testOrchestration.steps[2],
        sessionId,
        'test-tool'
      );
      expect(manager.getActiveStep).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getState', () => {
    it('should call stateManager.toAIOrchestrationState and return the result', async () => {
      const mockAIState: AIOrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        activeStep: 'test-step',
        sequenceIndex: 1,
        cumulativeTokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
      
      mockStateManager.toAIOrchestrationState.mockResolvedValueOnce(mockAIState);
      
      const result = await manager.getState(sessionId);
      
      expect(result).toEqual(mockAIState);
      expect(mockStateManager.toAIOrchestrationState).toHaveBeenCalledWith(sessionId);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should return null and log error if stateManager.toAIOrchestrationState throws', async () => {
      const error = new Error('Failed to get state');
      
      mockStateManager.toAIOrchestrationState.mockRejectedValueOnce(error);
      
      const result = await manager.getState(sessionId);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('updateState', () => {
    it('should call stateManager.updateState and return the result', async () => {
      const updates = {
        activeStep: 'new-step',
        sequenceIndex: 2
      };
      
      const updatedState = {
        sessionId,
        recentlyUsedTools: [],
        activeStep: 'new-step',
        sequenceIndex: 2,
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      mockStateManager.updateState.mockResolvedValueOnce(updatedState);
      
      const result = await manager.updateState(sessionId, updates);
      
      expect(result).toEqual(updatedState);
      expect(mockStateManager.updateState).toHaveBeenCalledWith(sessionId, updates);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should return null and log error if stateManager.updateState returns null', async () => {
      const updates = {
        activeStep: 'new-step',
        sequenceIndex: 2
      };
      
      mockStateManager.updateState.mockResolvedValueOnce(null);
      
      const result = await manager.updateState(sessionId, updates);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should return null and log error if stateManager.updateState throws', async () => {
      const updates = {
        activeStep: 'new-step',
        sequenceIndex: 2
      };
      
      const error = new Error('Failed to update state');
      
      mockStateManager.updateState.mockRejectedValueOnce(error);
      
      const result = await manager.updateState(sessionId, updates);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('resetState', () => {
    it('should call stateManager.resetState', async () => {
      await manager.resetState(sessionId);
      
      expect(mockStateManager.resetState).toHaveBeenCalledWith(sessionId);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should log error if stateManager.resetState throws', async () => {
      const error = new Error('Failed to reset state');
      
      mockStateManager.resetState.mockRejectedValueOnce(error);
      
      await manager.resetState(sessionId);
      
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('removeSession', () => {
    it('should call stateManager.cleanupSession', async () => {
      await manager.removeSession(sessionId);
      
      expect(mockStateManager.cleanupSession).toHaveBeenCalledWith(sessionId);
    });
  });
  
  describe('getStateManager', () => {
    it('should return the state manager instance', () => {
      const result = manager.getStateManager();
      
      expect(result).toBe(mockStateManager);
    });
  });
});
