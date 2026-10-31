import { createHash } from 'crypto';

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

// Determine winner without modulo bias using rejection sampling
export function determineWinner(randomness: string, totalParticipants: number): number {
  if (totalParticipants < 2) throw new Error('Need at least 2 participants');
  
  const chunks = randomness.match(/.{1,8}/g) || [];
  
  for (const chunk of chunks) {
    const value = parseInt(chunk, 16);
    const maxValid = Math.floor(0xFFFFFFFF / totalParticipants) * totalParticipants;
    
    if (value < maxValid) {
      return value % totalParticipants;
    }
  }
  
  // Extremely unlikely fallback
  const fallback = parseInt(randomness.slice(0, 8), 16);
  return fallback % totalParticipants;
}
