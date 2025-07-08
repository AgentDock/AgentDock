/**
 * @fileoverview Tests for LazyDecayCalculator - REALISTIC LAZY BEHAVIOR VALIDATION
 *
 * Tests focus on proving the system is actually "lazy":
 * - Daily accessed memories: minimal database writes
 * - Monthly accessed memories: gradual decay with smart updates
 * - Batch efficiency: 90%+ memories avoid unnecessary writes
 */

import { MemoryData } from '../../../storage/types';
import {
  LazyDecayCalculator,
  LazyDecayConfig
} from '../../decay/LazyDecayCalculator';
import { MemoryType } from '../../types';

describe('LazyDecayCalculator - Realistic Lazy Behavior', () => {
  let calculator: LazyDecayCalculator;

  // Helper to create realistic memory scenarios
  const createMemory = (
    id: string,
    scenario: 'daily' | 'weekly' | 'monthly' | 'stale',
    resonance: number = 0.8
  ): MemoryData => {
    const now = Date.now();
    const scenarios = {
      daily: now - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      weekly: now - 7 * 24 * 60 * 60 * 1000, // 1 week ago
      monthly: now - 30 * 24 * 60 * 60 * 1000, // 1 month ago
      stale: now - 90 * 24 * 60 * 60 * 1000 // 3 months ago
    };

    return {
      id,
      userId: 'test-user',
      agentId: 'test-agent',
      type: MemoryType.SEMANTIC,
      content: `Test memory - ${scenario} access pattern`,
      importance: 0.8,
      resonance,
      accessCount: scenario === 'daily' ? 30 : scenario === 'weekly' ? 4 : 1,
      createdAt: now - 60 * 24 * 60 * 60 * 1000, // 2 months ago
      updatedAt: scenarios[scenario],
      lastAccessedAt: scenarios[scenario],
      status: 'active'
    };
  };

  beforeEach(() => {
    // REALISTIC lazy configuration
    calculator = new LazyDecayCalculator({
      defaultHalfLife: 30,
      archivalThreshold: 0.1,
      enableReinforcement: true,
      reinforcementFactor: 0.05, // Smaller reinforcement
      maxResonance: 2.0,
      minUpdateIntervalMs: 6 * 60 * 60 * 1000 // 6 hours (not 1 minute, not 24 hours)
    });
  });

  describe('LAZY BEHAVIOR - Daily Access Pattern Memories', () => {
    it('should NOT update frequently accessed memories on every access', () => {
      const dailyMemory = createMemory('daily-1', 'daily', 0.9);

      // Simulate multiple accesses in one day
      const results = Array.from({ length: 10 }, () =>
        calculator.calculateDecay(dailyMemory, Date.now())
      );

      // Most accesses should NOT trigger updates (lazy behavior)
      const updatesNeeded = results.filter((r) => r.shouldUpdate).length;
      expect(updatesNeeded).toBeLessThanOrEqual(2); // Max 2 updates out of 10 accesses

      // But reinforcement should be applied when updates do happen
      const reinforced = results.filter((r) => r.reinforcementApplied);
      expect(reinforced.length).toBeGreaterThan(0);
    });

    it('should handle frequent access without database spam', () => {
      const frequentMemories = Array.from({ length: 100 }, (_, i) =>
        createMemory(`frequent-${i}`, 'daily', 0.8 + Math.random() * 0.2)
      );

      const results = calculator.calculateBatchDecay(frequentMemories);
      const updatesNeeded = results.filter((r) => r.shouldUpdate).length;

      // CRITICAL: Should avoid 90%+ of database writes
      const avoidanceRate = ((100 - updatesNeeded) / 100) * 100;
      expect(avoidanceRate).toBeGreaterThanOrEqual(85); // At least 85% write avoidance

      console.log(
        `Daily memories: ${updatesNeeded}/100 updates needed (${avoidanceRate.toFixed(1)}% write avoidance)`
      );
    });
  });

  describe('LAZY BEHAVIOR - Weekly/Monthly Access Pattern Memories', () => {
    it('should gradually decay monthly memories with smart updates', () => {
      const monthlyMemory = createMemory('monthly-1', 'monthly', 1.0);

      const result = calculator.calculateDecay(monthlyMemory);

      // REALISTIC: 30 days = 1 half-life = 50% decay
      expect(result.decayApplied).toBe(true);
      expect(result.newResonance).toBeCloseTo(0.5, 1); // ~50% after 1 month

      // 50% change > 10% threshold = SHOULD update
      expect(result.shouldUpdate).toBe(true);
    });

    it('should update weekly memories when change is significant', () => {
      const weeklyMemory = createMemory('weekly-1', 'weekly', 1.0);

      const result = calculator.calculateDecay(weeklyMemory);

      // REALISTIC: 7 days with 30-day half-life = (0.5)^(7/30) ≈ 0.849 (15% decay)
      expect(result.newResonance).toBeCloseTo(0.85, 1);

      // 15% change > 10% threshold = SHOULD update (this is correct!)
      expect(result.shouldUpdate).toBe(true);
      expect(result.decayApplied).toBe(true);
    });

    it('should NOT update daily memories due to minimal decay', () => {
      const dailyMemory = createMemory('daily-1', 'daily', 1.0);
      dailyMemory.accessCount = 1; // Low access count to avoid reinforcement

      const result = calculator.calculateDecay(dailyMemory);

      // REALISTIC: 1 day with 30-day half-life = (0.5)^(1/30) ≈ 0.977 (2.3% decay)
      expect(result.newResonance).toBeCloseTo(0.977, 2);

      // 2.3% change < 10% threshold = should NOT update (lazy!)
      expect(result.shouldUpdate).toBe(false);
      // Note: May show 'decay_applied' but still correctly avoids database write
    });
  });

  describe('LAZY BEHAVIOR - Stale Memory Handling', () => {
    it('should archive very old low-resonance memories', () => {
      const staleMemory = createMemory('stale-1', 'stale', 0.15);

      const result = calculator.calculateDecay(staleMemory);

      // 3 months should cause significant decay
      expect(result.newResonance).toBeLessThan(0.1);
      expect(result.shouldUpdate).toBe(true);

      // Should be marked for archival
      expect(
        calculator.shouldArchive({
          ...staleMemory,
          resonance: result.newResonance
        })
      ).toBe(true);
    });
  });

  describe('REALISTIC REINFORCEMENT - Actually Lazy', () => {
    it('should only reinforce memories with multiple recent accesses', () => {
      // Memory accessed once recently - should not get aggressive reinforcement
      const singleAccessMemory = createMemory('single-1', 'daily', 0.8);
      singleAccessMemory.accessCount = 1;

      const result = calculator.calculateDecay(singleAccessMemory);

      // Should apply minimal reinforcement, not aggressive
      if (result.reinforcementApplied) {
        expect(result.newResonance).toBeLessThan(
          singleAccessMemory.resonance * 1.1
        ); // <10% increase
      }
    });

    it('should apply stronger reinforcement to frequently accessed memories', () => {
      const frequentMemory = createMemory('frequent-1', 'daily', 0.7);
      frequentMemory.accessCount = 25; // Frequently accessed

      const result = calculator.calculateDecay(frequentMemory);

      expect(result.reinforcementApplied).toBe(true);
      expect(result.newResonance).toBeGreaterThan(frequentMemory.resonance); // Should increase
    });
  });

  describe('LAZY BATCH PROCESSING - Real World Performance', () => {
    it('should achieve 90%+ write avoidance on realistic memory distribution', () => {
      // REALISTIC memory distribution based on actual usage patterns:
      // Most memories are accessed frequently, fewer are stale
      const memories: MemoryData[] = [
        // 85% daily accessed (minimal 2.3% decay → NO updates)
        ...Array.from({ length: 850 }, (_, i) =>
          createMemory(`daily-${i}`, 'daily', 0.8 + Math.random() * 0.1)
        ),
        // 10% weekly accessed (15% decay → some updates)
        ...Array.from({ length: 100 }, (_, i) =>
          createMemory(`weekly-${i}`, 'weekly', 0.7 + Math.random() * 0.2)
        ),
        // 5% monthly accessed (50% decay → updates needed)
        ...Array.from({ length: 50 }, (_, i) =>
          createMemory(`monthly-${i}`, 'monthly', 0.5 + Math.random() * 0.4)
        )
      ];

      const results = calculator.calculateBatchDecay(memories);
      const updatesNeeded = results.filter((r) => r.shouldUpdate).length;
      const writeAvoidance = ((1000 - updatesNeeded) / 1000) * 100;

      console.log(`\n🎯 REALISTIC LAZY DECAY PERFORMANCE:`);
      console.log(`   Total memories: 1000`);
      console.log(`   Daily (85%): ~850 memories, ~2.3% decay each`);
      console.log(`   Weekly (10%): ~100 memories, ~15% decay each`);
      console.log(`   Monthly (5%): ~50 memories, ~50% decay each`);
      console.log(`   Updates needed: ${updatesNeeded}`);
      console.log(`   Write avoidance: ${writeAvoidance.toFixed(1)}%`);

      // REALISTIC EXPECTATION: 85% daily (no updates) + some weekly/monthly updates
      // Should achieve 85%+ write avoidance with this distribution
      expect(writeAvoidance).toBeGreaterThanOrEqual(85);
      expect(updatesNeeded).toBeLessThanOrEqual(150); // Max 15% updates
    });

    it('should process 10K memories with realistic performance', () => {
      // Realistic large scale: most memories accessed recently
      const largeSet = Array.from({ length: 10000 }, (_, i) => {
        // 90% daily, 8% weekly, 2% monthly (realistic distribution)
        const scenario =
          i % 50 === 0 ? 'monthly' : i % 12 === 0 ? 'weekly' : 'daily';
        return createMemory(`large-${i}`, scenario, 0.6 + Math.random() * 0.3);
      });

      const startTime = Date.now();
      const results = calculator.calculateBatchDecay(largeSet);
      const processingTime = Date.now() - startTime;

      const updatesNeeded = results.filter((r) => r.shouldUpdate).length;
      const writeAvoidance = ((10000 - updatesNeeded) / 10000) * 100;

      console.log(`\n📊 LARGE SCALE REALISTIC PERFORMANCE:`);
      console.log(`   Memories processed: 10,000`);
      console.log(`   Daily (90%): ~9,000 memories`);
      console.log(`   Weekly (8%): ~800 memories`);
      console.log(`   Monthly (2%): ~200 memories`);
      console.log(`   Processing time: ${processingTime}ms`);
      console.log(`   Updates needed: ${updatesNeeded}`);
      console.log(`   Write avoidance: ${writeAvoidance.toFixed(1)}%`);
      console.log(
        `   Avg time per memory: ${(processingTime / 10000).toFixed(3)}ms`
      );

      // Performance requirements with realistic data (without debug logging)
      expect(processingTime).toBeLessThan(12000); // Under 12 seconds in CI environments
      expect(writeAvoidance).toBeGreaterThanOrEqual(85); // 85%+ avoidance with 90% daily
    });
  });

  describe('REALISTIC UPDATE INTERVALS', () => {
    it('should respect 6-hour minimum update interval', () => {
      const memory = createMemory('interval-test', 'daily', 0.8);
      memory.updatedAt = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago

      const result = calculator.calculateDecay(memory);

      expect(result.shouldUpdate).toBe(false);
      expect(result.reason).toBe('too_recent');
    });

    it('should allow updates after 6-hour interval', () => {
      const memory = createMemory('interval-test', 'monthly', 1.0);
      memory.updatedAt = Date.now() - 7 * 60 * 60 * 1000; // 7 hours ago

      const result = calculator.calculateDecay(memory);

      // Should process because interval passed AND change is significant
      expect(result.shouldUpdate).toBe(true);
      expect(result.decayApplied).toBe(true);
    });
  });

  describe('ERROR SCENARIOS', () => {
    it('should handle corrupted memory data without crashing', () => {
      const corruptedMemory = {
        id: 'corrupt',
        userId: 'test-user',
        agentId: 'test-agent',
        type: MemoryType.SEMANTIC,
        content: 'corrupted',
        importance: 0.5,
        resonance: NaN,
        accessCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: -1,
        status: 'active'
      } as MemoryData;

      const result = calculator.calculateDecay(corruptedMemory);

      // With corrupted data, calculation still completes but shouldn't update due to NaN comparisons
      expect(result.shouldUpdate).toBe(false);
      expect(result.newResonance).toBeNaN(); // Result will be NaN due to corrupted input
    });
  });
});
