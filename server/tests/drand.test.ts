import { describe, it, expect } from 'vitest';
import { getCurrentRound, getRoundTime, DRAND_CHAIN } from '../src/lib/drand.js';

describe('Drand utilities', () => {
  describe('getCurrentRound', () => {
    it('should return a positive number', () => {
      const round = getCurrentRound();
      expect(round).toBeGreaterThan(0);
    });

    it('should increase over time', () => {
      const round1 = getCurrentRound();
      // Wait a tiny bit
      const round2 = getCurrentRound();
      expect(round2).toBeGreaterThanOrEqual(round1);
    });
  });

  describe('getRoundTime', () => {
    it('should return a Date object', () => {
      const time = getRoundTime(1000);
      expect(time).toBeInstanceOf(Date);
    });

    it('should return future time for future rounds', () => {
      const currentRound = getCurrentRound();
      const futureTime = getRoundTime(currentRound + 100);
      expect(futureTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return past time for early rounds', () => {
      const earlyTime = getRoundTime(1);
      expect(earlyTime.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('DRAND_CHAIN', () => {
    it('should have valid chain hash', () => {
      expect(DRAND_CHAIN.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should have valid beacon period', () => {
      expect(DRAND_CHAIN.beaconPeriod).toBeGreaterThan(0);
    });
  });
});
