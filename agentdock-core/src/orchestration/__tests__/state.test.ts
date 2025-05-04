import { OrchestrationStateManager, OrchestrationState } from '../state';
import { SessionId } from '../../types/session';
import { createMockStorageProvider } from '../../test/setup';
import { logger } from '../../logging';
import { SessionManager } from '../../session';

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

const mockGetSession = jest.fn();
const mockCreateSession = jest.fn();
const mockUpdateSession = jest.fn();
const mockDeleteSession = jest.fn();

jest.mock('../../session', () => {
  return {
    SessionManager: jest.fn().mockImplementation(() => ({
      getSession: mockGetSession,
      createSession: mockCreateSession,
      updateSession: mockUpdateSession,
      deleteSession: mockDeleteSession
    }))
  };
});

describe('OrchestrationStateManager', () => {
  let stateManager: OrchestrationStateManager;
  let mockStorageProvider: ReturnType<typeof createMockStorageProvider>;
  const sessionId: SessionId = 'test-session-id';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorageProvider = createMockStorageProvider();
    
    stateManager = new OrchestrationStateManager({
      storageProvider: mockStorageProvider,
      storageNamespace: 'test-namespace'
    });
  });
  
  describe('getState', () => {
    it('should return null if session manager returns unsuccessful result', async () => {
      mockGetSession.mockResolvedValueOnce({
        success: false,
        error: 'Session not found'
      });
      
      const result = await stateManager.getState(sessionId);
      
      expect(result).toBeNull();
      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
    });
    
    it('should return null if session manager returns successful result with no data', async () => {
      mockGetSession.mockResolvedValueOnce({
        success: true,
        data: null
      });
      
      const result = await stateManager.getState(sessionId);
      
      expect(result).toBeNull();
      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
    });
    
    it('should return state if session manager returns successful result with data', async () => {
      const mockState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        activeStep: 'step1',
        sequenceIndex: 1,
        lastAccessed: Date.now(),
        ttl: 3600000,
        cumulativeTokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
      
      mockGetSession.mockResolvedValueOnce({
        success: true,
        data: mockState
      });
      
      const result = await stateManager.getState(sessionId);
      
      expect(result).toEqual(mockState);
      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
    });
  });
  
  describe('getOrCreateState', () => {
    it('should warn and create a new session if sessionId is empty', async () => {
      mockCreateSession.mockResolvedValueOnce({
        success: true,
        data: {
          sessionId: 'new-session-id',
          recentlyUsedTools: [],
          sequenceIndex: 0,
          lastAccessed: expect.any(Number),
          ttl: expect.any(Number),
          cumulativeTokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          }
        }
      });
      
      const result = await stateManager.getOrCreateState('');
      
      expect(result).not.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
      expect(mockCreateSession).toHaveBeenCalled();
    });
    
    it('should return null if session creation fails', async () => {
      mockCreateSession.mockResolvedValueOnce({
        success: false,
        error: 'Failed to create session'
      });
      
      const result = await stateManager.getOrCreateState('');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should get existing state if it exists', async () => {
      const mockState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        activeStep: 'step1',
        sequenceIndex: 1,
        lastAccessed: Date.now(),
        ttl: 3600000,
        cumulativeTokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(mockState);
      
      const result = await stateManager.getOrCreateState(sessionId);
      
      expect(result).toEqual(mockState);
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
    
    it('should create new state if it does not exist', async () => {
      const newState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 0,
        lastAccessed: expect.any(Number),
        ttl: expect.any(Number),
        cumulativeTokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(null);
      
      mockCreateSession.mockResolvedValueOnce({
        success: true,
        data: newState
      });
      
      const result = await stateManager.getOrCreateState(sessionId);
      
      expect(result).toEqual(newState);
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockCreateSession).toHaveBeenCalledWith({
        sessionId
      });
    });
    
    it('should return null if state creation fails', async () => {
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(null);
      
      mockCreateSession.mockResolvedValueOnce({
        success: false,
        error: 'Failed to create session'
      });
      
      const result = await stateManager.getOrCreateState(sessionId);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('updateState', () => {
    it('should update state and return updated state on success', async () => {
      const updates = {
        activeStep: 'new-step',
        sequenceIndex: 2
      };
      
      const updatedState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        activeStep: 'new-step',
        sequenceIndex: 2,
        lastAccessed: expect.any(Number),
        ttl: 3600000
      };
      
      mockUpdateSession.mockResolvedValueOnce({
        success: true,
        data: updatedState
      });
      
      const result = await stateManager.updateState(sessionId, updates);
      
      expect(result).toEqual(updatedState);
      expect(mockUpdateSession).toHaveBeenCalledWith(
        sessionId,
        expect.any(Function)
      );
    });
    
    it('should return null and log error if update fails', async () => {
      const updates = {
        activeStep: 'new-step',
        sequenceIndex: 2
      };
      
      mockUpdateSession.mockResolvedValueOnce({
        success: false,
        error: 'Failed to update session'
      });
      
      const result = await stateManager.updateState(sessionId, updates);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should include lastAccessed timestamp in updates', async () => {
      const updates = {
        activeStep: 'new-step'
      };
      
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now() - 1000, // Old timestamp
        ttl: 3600000
      };
      
      let capturedUpdateFn: Function | undefined;
      mockUpdateSession.mockImplementationOnce(
        (sid, updateFn) => {
          capturedUpdateFn = updateFn;
          const updatedState = updateFn(currentState);
          return Promise.resolve({
            success: true,
            data: updatedState
          });
        }
      );
      
      await stateManager.updateState(sessionId, updates);
      
      expect(capturedUpdateFn).toBeDefined();
      const result = (capturedUpdateFn as Function)(currentState);
      
      expect(result.lastAccessed).not.toEqual(currentState.lastAccessed);
      expect(result.lastAccessed).toBeGreaterThan(currentState.lastAccessed);
      expect(result.activeStep).toEqual(updates.activeStep);
    });
  });
  
  describe('setActiveStep', () => {
    it('should call updateState with activeStep', async () => {
      const stepName = 'test-step';
      const updatedState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        activeStep: stepName,
        lastAccessed: expect.any(Number),
        ttl: 3600000
      };
      
      jest.spyOn(stateManager, 'updateState').mockResolvedValueOnce(updatedState);
      
      const result = await stateManager.setActiveStep(sessionId, stepName);
      
      expect(result).toEqual(updatedState);
      expect(stateManager.updateState).toHaveBeenCalledWith(sessionId, { activeStep: stepName });
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should log error if updateState returns null', async () => {
      const stepName = 'test-step';
      
      jest.spyOn(stateManager, 'updateState').mockResolvedValueOnce(null);
      
      const result = await stateManager.setActiveStep(sessionId, stepName);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('addUsedTool', () => {
    it('should add tool to recentlyUsedTools and return updated state', async () => {
      const toolName = 'new-tool';
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      const updatedState: OrchestrationState = {
        ...currentState,
        recentlyUsedTools: [toolName, 'tool1', 'tool2']
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(currentState);
      
      const mockUpdateState = jest.fn().mockResolvedValueOnce(updatedState);
      stateManager.updateState = mockUpdateState;
      
      const result = await stateManager.addUsedTool(sessionId, toolName);
      
      expect(result).toEqual(updatedState);
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockUpdateState).toHaveBeenCalledWith(
        sessionId,
        { recentlyUsedTools: [toolName, 'tool1', 'tool2'] }
      );
    });
    
    it('should return null if getState returns null', async () => {
      const toolName = 'new-tool';
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(null);
      
      const mockUpdateState = jest.fn();
      stateManager.updateState = mockUpdateState;
      
      const result = await stateManager.addUsedTool(sessionId, toolName);
      
      expect(result).toBeNull();
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockUpdateState).not.toHaveBeenCalled();
    });
    
    it('should remove duplicate tool and add to front of list', async () => {
      const toolName = 'tool2'; // Already in the list
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2', 'tool3'],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      const updatedState: OrchestrationState = {
        ...currentState,
        recentlyUsedTools: ['tool2', 'tool1', 'tool3']
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(currentState);
      
      jest.spyOn(stateManager, 'updateState').mockResolvedValueOnce(updatedState);
      
      const result = await stateManager.addUsedTool(sessionId, toolName);
      
      expect(result).toEqual(updatedState);
      expect(stateManager.updateState).toHaveBeenCalledWith(
        sessionId,
        { recentlyUsedTools: ['tool2', 'tool1', 'tool3'] }
      );
    });
    
    it('should limit recentlyUsedTools to 10 items', async () => {
      const toolName = 'new-tool';
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2', 'tool3', 'tool4', 'tool5', 'tool6', 'tool7', 'tool8', 'tool9', 'tool10'],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      const expectedTools = [
        'new-tool', 'tool1', 'tool2', 'tool3', 'tool4', 
        'tool5', 'tool6', 'tool7', 'tool8', 'tool9'
      ];
      
      const updatedState: OrchestrationState = {
        ...currentState,
        recentlyUsedTools: expectedTools
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(currentState);
      
      jest.spyOn(stateManager, 'updateState').mockResolvedValueOnce(updatedState);
      
      const result = await stateManager.addUsedTool(sessionId, toolName);
      
      expect(result).toEqual(updatedState);
      expect(stateManager.updateState).toHaveBeenCalledWith(
        sessionId,
        { recentlyUsedTools: expectedTools }
      );
      expect(updatedState.recentlyUsedTools.length).toBeLessThanOrEqual(10);
    });
  });
  
  describe('advanceSequence', () => {
    it('should increment sequenceIndex and return updated state', async () => {
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 1,
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      const updatedState: OrchestrationState = {
        ...currentState,
        sequenceIndex: 2
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(currentState);
      
      const mockUpdateState = jest.fn().mockResolvedValueOnce(updatedState);
      stateManager.updateState = mockUpdateState;
      
      const result = await stateManager.advanceSequence(sessionId);
      
      expect(result).toEqual(updatedState);
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockUpdateState).toHaveBeenCalledWith(sessionId, { sequenceIndex: 2 });
    });
    
    it('should handle undefined sequenceIndex by treating it as -1', async () => {
      const currentState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      };
      
      const updatedState: OrchestrationState = {
        ...currentState,
        sequenceIndex: 0 // -1 + 1 = 0
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(currentState);
      
      const mockUpdateState = jest.fn().mockResolvedValueOnce(updatedState);
      stateManager.updateState = mockUpdateState;
      
      const result = await stateManager.advanceSequence(sessionId);
      
      expect(result).toEqual(updatedState);
      expect(mockUpdateState).toHaveBeenCalledWith(sessionId, { sequenceIndex: 0 });
    });
    
    it('should return null if getState returns null', async () => {
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(null);
      
      const mockUpdateState = jest.fn();
      stateManager.updateState = mockUpdateState;
      
      const result = await stateManager.advanceSequence(sessionId);
      
      expect(result).toBeNull();
      expect(stateManager.getState).toHaveBeenCalledWith(sessionId);
      expect(mockUpdateState).not.toHaveBeenCalled();
    });
  });
  
  describe('resetState', () => {
    it('should call cleanupSession and return null', async () => {
      jest.spyOn(stateManager, 'cleanupSession').mockResolvedValueOnce();
      
      const result = await stateManager.resetState(sessionId);
      
      expect(result).toBeNull();
      expect(stateManager.cleanupSession).toHaveBeenCalledWith(sessionId);
      expect(logger.debug).toHaveBeenCalled();
    });
  });
  
  describe('toAIOrchestrationState', () => {
    it('should convert OrchestrationState to AIOrchestrationState', async () => {
      const fullState: OrchestrationState = {
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        activeStep: 'step1',
        sequenceIndex: 1,
        lastAccessed: Date.now(),
        ttl: 3600000,
        cumulativeTokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
      
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(fullState);
      
      const result = await stateManager.toAIOrchestrationState(sessionId);
      
      expect(result).toEqual({
        sessionId,
        recentlyUsedTools: ['tool1', 'tool2'],
        activeStep: 'step1',
        sequenceIndex: 1,
        cumulativeTokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      });
    });
    
    it('should return null if getState returns null', async () => {
      jest.spyOn(stateManager, 'getState').mockResolvedValueOnce(null);
      
      const result = await stateManager.toAIOrchestrationState(sessionId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('cleanupSession', () => {
    it('should call SessionManager.deleteSession and log success', async () => {
      mockDeleteSession.mockResolvedValueOnce(undefined);
      
      await stateManager.cleanupSession(sessionId);
      
      expect(mockDeleteSession).toHaveBeenCalledWith(sessionId);
      expect(logger.debug).toHaveBeenCalled();
    });
    
    it('should log error if SessionManager.deleteSession throws', async () => {
      const error = new Error('Delete failed');
      
      mockDeleteSession.mockRejectedValueOnce(error);
      
      await stateManager.cleanupSession(sessionId);
      
      expect(mockDeleteSession).toHaveBeenCalledWith(sessionId);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
