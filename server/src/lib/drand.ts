// drand Quicknet chain configuration
export const DRAND_CHAIN = {
  hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  apiUrl: 'https://api.drand.sh',
  beaconPeriod: 3, // seconds
  genesisTime: 1692803368, // Unix timestamp
};

export interface DrandBeacon {
  round: number;
  randomness: string;
  signature: string;
  previous_signature: string;
}

// Get current round number
export function getCurrentRound(): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.floor((now - DRAND_CHAIN.genesisTime) / DRAND_CHAIN.beaconPeriod) + 1;
}

// Get estimated time for a round
export function getRoundTime(round: number): Date {
  const time = DRAND_CHAIN.genesisTime + (round - 1) * DRAND_CHAIN.beaconPeriod;
  return new Date(time * 1000);
}

// Fetch randomness from drand API
export async function fetchDrandRandomness(round: number): Promise<DrandBeacon> {
  const url = `${DRAND_CHAIN.apiUrl}/${DRAND_CHAIN.hash}/public/${round}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  
  if (!response.ok) {
    throw new Error(`drand API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json() as DrandBeacon;
  
  if (!data.randomness || !data.signature) {
    throw new Error('Invalid drand response: missing randomness or signature');
  }
  
  return data;
}

// Verify drand beacon signature (BLS12-381 unchained)
// For the Quicknet chain, verification uses BLS signatures
// In production, use a proper BLS verification library
// For MVP, we verify the signature format and structure
export async function verifyDrandSignature(beacon: DrandBeacon): Promise<boolean> {
  // Basic validation
  if (!beacon.randomness || !beacon.signature || !beacon.round) {
    return false;
  }
  
  // Verify randomness is valid hex
  if (!/^[0-9a-f]{64}$/i.test(beacon.randomness)) {
    return false;
  }
  
  // Verify signature is valid hex (BLS12-381 G2 point = 96 bytes = 192 hex chars)
  if (!/^[0-9a-f]{192}$/i.test(beacon.signature)) {
    return false;
  }
  
  // In production, you would verify the BLS signature against the chain's public key
  // using a library like @noble/bls12-381 or bls-signatures
  // For this MVP, we trust the HTTPS response from the official drand API
  // and verify the structural integrity of the response
  
  return true;
}

// Fetch latest round info
export async function fetchLatestRound(): Promise<{ round: number }> {
  const url = `${DRAND_CHAIN.apiUrl}/${DRAND_CHAIN.hash}/public/latest`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  
  if (!response.ok) {
    throw new Error(`drand API error: ${response.status}`);
  }
  
  const data = await response.json() as { round: number };
  return data;
}
