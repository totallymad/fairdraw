// SHA-256 hashing using Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Canonical representation of participants for hashing
export function canonicalParticipants(participants: { name: string; vk_url?: string; position: number }[]): string {
  const sorted = [...participants].sort((a, b) => a.position - b.position);
  return JSON.stringify(sorted.map(p => ({
    name: p.name,
    vk_url: p.vk_url || null,
    position: p.position
  })));
}

// Drand simulation for demo (in real backend, this calls the actual drand API)
// This simulates the deterministic randomness that drand provides
export async function simulateDrandRandomness(round: number, chainHash: string): Promise<{
  randomness: string;
  signature: string;
  round: number;
}> {
  // In the real implementation, this would:
  // 1. Wait until the round time
  // 2. Fetch from https://api.drand.sh/{chainHash}/public/{round}
  // 3. Verify the BLS signature
  // For demo, we simulate with deterministic hash-based randomness
  
  const seed = `${chainHash}:${round}:drand-demo`;
  const randomness = await sha256(seed);
  const signature = await sha256(`sig:${seed}`);
  
  return {
    randomness,
    signature,
    round
  };
}

// Determine winner without modulo bias using rejection sampling
export function determineWinner(
  randomness: string,
  totalParticipants: number
): number {
  // Convert randomness hex to a large number representation
  // Use rejection sampling to avoid modulo bias
  const hexChars = randomness.match(/.{1,8}/g) || [];
  
  for (const chunk of hexChars) {
    const value = parseInt(chunk, 16);
    const maxValid = Math.floor(0xFFFFFFFF / totalParticipants) * totalParticipants;
    
    if (value < maxValid) {
      return value % totalParticipants;
    }
  }
  
  // Fallback: use first 8 chars (extremely unlikely to reach here)
  const fallback = parseInt(randomness.slice(0, 8), 16);
  return fallback % totalParticipants;
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 8) + 
         Date.now().toString(36).substring(4);
}

// DRAND chain info (Quicknet - the fast chain)
export const DRAND_CHAIN = {
  hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  apiUrl: 'https://api.drand.sh',
  beaconPeriod: 3, // seconds
};

// Get current drand round estimate
export function getCurrentDrandRound(): number {
  const genesisTime = 1692803368; // Quicknet genesis
  const now = Math.floor(Date.now() / 1000);
  return Math.floor((now - genesisTime) / DRAND_CHAIN.beaconPeriod) + 1;
}

// Get time for a future round
export function getRoundTime(round: number): Date {
  const genesisTime = 1692803368;
  const time = genesisTime + (round - 1) * DRAND_CHAIN.beaconPeriod;
  return new Date(time * 1000);
}
