import { logger } from '../../logging';
import { createMockOrchestrationManager } from '../../test/setup';
import { OrchestrationStep } from '../../types/orchestration';
import { SessionId } from '../../types/session';
import { StepSequencer } from '../sequencer';
import { OrchestrationStateManager } from '../state';

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

describe('StepSequencer', () => {
  let sequencer: StepSequencer;
  let mockStateManager: jest.Mocked<OrchestrationStateManager>;
  const sessionId: SessionId = 'test-session-id';

  const stepWithSequence: OrchestrationStep = {
    name: 'test-step',
    description: 'A test step with a sequence',
    sequence: ['tool1', 'tool2', 'tool3'],
    isDefault: false
  };

  const stepWithoutSequence: OrchestrationStep = {
    name: 'no-sequence-step',
    description: 'A test step without a sequence',
    isDefault: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockStateManager = {
      getState: jest.fn(),
      setState: jest.fn(),
      updateState: jest.fn(),
      clearState: jest.fn(),
      addUsedTool: jest.fn()
    } as unknown as jest.Mocked<OrchestrationStateManager>;

    sequencer = new StepSequencer(mockStateManager);
  });

  describe('hasActiveSequence', () => {
    it('should return false if step has no sequence', async () => {
      const result = await sequencer.hasActiveSequence(
        stepWithoutSequence,
        sessionId
      );
      expect(result).toBe(false);
    });

    it('should return false if sequence index is beyond sequence length', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 3, // Beyond the length of the sequence (0-2)
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.hasActiveSequence(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe(false);
    });

    it('should return true if sequence index is within sequence length', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 1, // Within the sequence (0-2)
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.hasActiveSequence(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe(true);
    });

    it('should initialize sequence index to 0 if state does not exist', async () => {
      mockStateManager.getState.mockResolvedValueOnce(null);

      const result = await sequencer.hasActiveSequence(
        stepWithSequence,
        sessionId
      );

      expect(result).toBe(true);
      expect(mockStateManager.updateState).toHaveBeenCalledWith(sessionId, {
        sequenceIndex: 0
      });
    });

    it('should initialize sequence index to 0 if it is undefined', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.hasActiveSequence(
        stepWithSequence,
        sessionId
      );

      expect(result).toBe(true);
      expect(mockStateManager.updateState).toHaveBeenCalledWith(sessionId, {
        sequenceIndex: 0
      });
    });
  });

  describe('getCurrentSequenceTool', () => {
    it('should return null if step has no sequence', async () => {
      const result = await sequencer.getCurrentSequenceTool(
        stepWithoutSequence,
        sessionId
      );
      expect(result).toBe(null);
    });

    it('should return null if no active sequence', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(false);

      const result = await sequencer.getCurrentSequenceTool(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe(null);
    });

    it('should return the current tool in the sequence', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 1, // Second tool in sequence (0-indexed)
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.getCurrentSequenceTool(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe('tool2'); // Second tool in the sequence
    });

    it('should return first tool as fallback if state is missing after hasActiveSequence check', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      mockStateManager.getState.mockResolvedValueOnce(null);

      const result = await sequencer.getCurrentSequenceTool(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe('tool1'); // First tool as fallback
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return first tool as fallback if sequenceIndex is undefined after hasActiveSequence check', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.getCurrentSequenceTool(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe('tool1'); // First tool as fallback
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('advanceSequence', () => {
    it('should return false if step has no sequence', async () => {
      const result = await sequencer.advanceSequence(
        stepWithoutSequence,
        sessionId
      );
      expect(result).toBe(false);
    });

    it('should return false if state does not exist', async () => {
      mockStateManager.getState.mockResolvedValueOnce(null);

      const result = await sequencer.advanceSequence(
        stepWithSequence,
        sessionId
      );
      expect(result).toBe(false);
    });

    it('should advance sequence index and return true', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        sequenceIndex: 1,
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.advanceSequence(
        stepWithSequence,
        sessionId
      );

      expect(result).toBe(true);
      expect(mockStateManager.updateState).toHaveBeenCalledWith(sessionId, {
        sequenceIndex: 2
      });
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle undefined sequence index by treating it as 0', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      const result = await sequencer.advanceSequence(
        stepWithSequence,
        sessionId
      );

      expect(result).toBe(true);
      expect(mockStateManager.updateState).toHaveBeenCalledWith(sessionId, {
        sequenceIndex: 1
      });
    });
  });

  describe('processTool', () => {
    it('should add used tool to state', async () => {
      mockStateManager.getState.mockResolvedValueOnce({
        sessionId,
        recentlyUsedTools: [],
        lastAccessed: Date.now(),
        ttl: 3600000
      });

      await sequencer.processTool(stepWithoutSequence, sessionId, 'some-tool');

      expect(mockStateManager.addUsedTool).toHaveBeenCalledWith(
        sessionId,
        'some-tool'
      );
    });

    it('should return true if step has no sequence', async () => {
      const result = await sequencer.processTool(
        stepWithoutSequence,
        sessionId,
        'some-tool'
      );
      expect(result).toBe(true);
    });

    it('should return true if current tool is null (end of sequence)', async () => {
      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce(null);

      const result = await sequencer.processTool(
        stepWithSequence,
        sessionId,
        'some-tool'
      );
      expect(result).toBe(true);
    });

    it('should advance sequence and return true if tool matches current sequence tool', async () => {
      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce('tool1');

      jest.spyOn(sequencer, 'advanceSequence').mockResolvedValueOnce(true);

      const result = await sequencer.processTool(
        stepWithSequence,
        sessionId,
        'tool1'
      );

      expect(result).toBe(true);
      expect(sequencer.advanceSequence).toHaveBeenCalledWith(
        stepWithSequence,
        sessionId
      );
    });

    it('should return false if tool does not match current sequence tool', async () => {
      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce('tool1');

      const mockAdvanceSequence = jest.fn();
      sequencer.advanceSequence = mockAdvanceSequence;

      const result = await sequencer.processTool(
        stepWithSequence,
        sessionId,
        'wrong-tool'
      );

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
      expect(mockAdvanceSequence).not.toHaveBeenCalled();
    });
  });

  describe('filterToolsBySequence', () => {
    const allToolIds = ['tool1', 'tool2', 'tool3', 'tool4', 'tool5'];

    it('should return all tools if step has no sequence', async () => {
      const result = await sequencer.filterToolsBySequence(
        stepWithoutSequence,
        sessionId,
        allToolIds
      );
      expect(result).toEqual(allToolIds);
    });

    it('should return all tools if no active sequence', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(false);

      const result = await sequencer.filterToolsBySequence(
        stepWithSequence,
        sessionId,
        allToolIds
      );
      expect(result).toEqual(allToolIds);
    });

    it('should return all tools if current tool is null (sequence complete)', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce(null);

      const result = await sequencer.filterToolsBySequence(
        stepWithSequence,
        sessionId,
        allToolIds
      );
      expect(result).toEqual(allToolIds);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should return only the current sequence tool if it is available', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce('tool2');

      const result = await sequencer.filterToolsBySequence(
        stepWithSequence,
        sessionId,
        allToolIds
      );
      expect(result).toEqual(['tool2']);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should return empty array if current sequence tool is not available', async () => {
      jest.spyOn(sequencer, 'hasActiveSequence').mockResolvedValueOnce(true);

      jest
        .spyOn(sequencer, 'getCurrentSequenceTool')
        .mockResolvedValueOnce('unavailable-tool');

      const result = await sequencer.filterToolsBySequence(
        stepWithSequence,
        sessionId,
        allToolIds
      );
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
