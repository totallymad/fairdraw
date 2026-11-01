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

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 8) + 
         Date.now().toString(36).substring(4);
}
