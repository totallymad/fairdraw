export type DrawStatus = 'draft' | 'finalized' | 'completed' | 'failed';

export interface Participant {
  id: string;
  name: string;
  vk_url?: string;
  position: number;
}

export interface Draw {
  id: string;
  title: string;
  description: string;
  status: DrawStatus;
  participants: Participant[];
  participants_hash?: string;
  drand_chain_hash?: string;
  drand_round?: number;
  randomness?: string;
  signature?: string;
  winner_id?: string;
  created_at: string;
  finalized_at?: string;
  completed_at?: string;
}

export interface DrawVerificationData {
  draw_id: string;
  title: string;
  participants_hash: string;
  drand_chain_hash: string;
  drand_round: number;
  randomness: string;
  signature: string;
  winner: {
    id: string;
    name: string;
    position: number;
  };
  total_participants: number;
  verification_method: string;
}
