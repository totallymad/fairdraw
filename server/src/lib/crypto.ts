import { createHash, randomInt } from 'crypto';

// SHA-256 hash
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

// Canonical representation of participants for hashing
export function canonicalParticipants(
  participants: Array<{ name: string; vk_url?: string | null; position: number }>
): string {
  const sorted = [...participants].sort((a, b) => a.position - b.position);
  return JSON.stringify(sorted.map(p => ({
    name: p.name,
    vk_url: p.vk_url || null,
    position: p.position
  })));
}

// Determine winner using cryptographically secure random
export function determineWinner(totalParticipants: number): number {
  if (totalParticipants < 2) throw new Error('Need at least 2 participants');
  // crypto.randomInt is cryptographically secure
  return randomInt(0, totalParticipants);
}

// Generate unique ID
export function generateId(): string {
  return randomInt(100000, 999999).toString(36) + Date.now().toString(36);
}
