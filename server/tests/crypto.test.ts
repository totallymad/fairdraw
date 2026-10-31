import { describe, it, expect } from 'vitest';
import { sha256, canonicalParticipants, determineWinner } from '../src/lib/crypto.js';

describe('Crypto utilities', () => {
  describe('sha256', () => {
    it('should produce correct SHA-256 hash', () => {
      const hash = sha256('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('input1');
      const hash2 = sha256('input2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce consistent hashes', () => {
      const hash1 = sha256('test');
      const hash2 = sha256('test');
      expect(hash1).toBe(hash2);
    });
  });

  describe('canonicalParticipants', () => {
    it('should sort participants by position', () => {
      const participants = [
        { name: 'Bob', position: 2 },
        { name: 'Alice', position: 1 },
      ];
      const canonical = canonicalParticipants(participants);
      const parsed = JSON.parse(canonical);
      expect(parsed[0].name).toBe('Alice');
      expect(parsed[1].name).toBe('Bob');
    });

    it('should include vk_url as null when not provided', () => {
      const participants = [{ name: 'Test', position: 1 }];
      const canonical = canonicalParticipants(participants);
      const parsed = JSON.parse(canonical);
      expect(parsed[0].vk_url).toBeNull();
    });

    it('should produce same hash regardless of input order', () => {
      const p1 = [
        { name: 'A', vk_url: 'https://vk.com/a', position: 1 },
        { name: 'B', position: 2 },
      ];
      const p2 = [
        { name: 'B', position: 2 },
        { name: 'A', vk_url: 'https://vk.com/a', position: 1 },
      ];
      expect(canonicalParticipants(p1)).toBe(canonicalParticipants(p2));
    });
  });

  describe('determineWinner', () => {
    it('should return a valid index', () => {
      const randomness = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const index = determineWinner(randomness, 5);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
    });

    it('should be deterministic', () => {
      const randomness = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const index1 = determineWinner(randomness, 10);
      const index2 = determineWinner(randomness, 10);
      expect(index1).toBe(index2);
    });

    it('should throw for less than 2 participants', () => {
      expect(() => determineWinner('abc', 1)).toThrow('Need at least 2 participants');
    });

    it('should distribute winners across all positions over many runs', () => {
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const randomness = sha256(`seed-${i}`);
        const index = determineWinner(randomness, 5);
        results.add(index);
      }
      // With 100 random inputs and 5 positions, we should see all positions
      expect(results.size).toBe(5);
    });
  });
});
