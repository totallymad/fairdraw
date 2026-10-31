import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Draw, Participant, DrawStatus } from '../types';
import { sha256, canonicalParticipants, simulateDrandRandomness, determineWinner, generateId, getCurrentDrandRound } from '../lib/crypto';

interface DrawStore {
  draws: Draw[];
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  createDraw: (title: string, description: string) => string;
  updateDraw: (id: string, updates: Partial<Draw>) => void;
  addParticipant: (drawId: string, name: string, vk_url?: string) => void;
  removeParticipant: (drawId: string, participantId: string) => void;
  finalizeDraw: (drawId: string) => Promise<void>;
  executeDraw: (drawId: string) => Promise<void>;
  getDraw: (id: string) => Draw | undefined;
  getAllDraws: () => Draw[];
}

export const useDrawStore = create<DrawStore>()(
  persist(
    (set, get) => ({
      draws: [],
      isAuthenticated: false,

      login: (password: string) => {
        // In production, this would be checked against env variable on backend
        // For demo, we accept any non-empty password
        if (password && password.length >= 4) {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ isAuthenticated: false });
      },

      createDraw: (title: string, description: string) => {
        const id = generateId();
        const newDraw: Draw = {
          id,
          title,
          description,
          status: 'draft',
          participants: [],
          created_at: new Date().toISOString(),
        };
        set(state => ({ draws: [...state.draws, newDraw] }));
        return id;
      },

      updateDraw: (id: string, updates: Partial<Draw>) => {
        set(state => ({
          draws: state.draws.map(d => d.id === id ? { ...d, ...updates } : d)
        }));
      },

      addParticipant: (drawId: string, name: string, vk_url?: string) => {
        set(state => {
          const draw = state.draws.find(d => d.id === drawId);
          if (!draw || draw.status !== 'draft') return state;
          
          const newParticipant: Participant = {
            id: generateId(),
            name,
            vk_url: vk_url || undefined,
            position: draw.participants.length + 1,
          };
          
          return {
            draws: state.draws.map(d => 
              d.id === drawId 
                ? { ...d, participants: [...d.participants, newParticipant] }
                : d
            )
          };
        });
      },

      removeParticipant: (drawId: string, participantId: string) => {
        set(state => {
          const draw = state.draws.find(d => d.id === drawId);
          if (!draw || draw.status !== 'draft') return state;
          
          const updatedParticipants = draw.participants
            .filter(p => p.id !== participantId)
            .map((p, i) => ({ ...p, position: i + 1 }));
          
          return {
            draws: state.draws.map(d => 
              d.id === drawId 
                ? { ...d, participants: updatedParticipants }
                : d
            )
          };
        });
      },

      finalizeDraw: async (drawId: string) => {
        const draw = get().draws.find(d => d.id === drawId);
        if (!draw || draw.status !== 'draft') return;
        if (draw.participants.length < 2) throw new Error('Минимум 2 участника');
        
        const canonical = canonicalParticipants(draw.participants);
        const hash = await sha256(canonical);
        const futureRound = getCurrentDrandRound() + 5; // 5 rounds in the future (~15 sec)
        
        set(state => ({
          draws: state.draws.map(d => 
            d.id === drawId 
              ? { 
                  ...d, 
                  status: 'finalized' as DrawStatus,
                  participants_hash: hash,
                  drand_chain_hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
                  drand_round: futureRound,
                  finalized_at: new Date().toISOString(),
                }
              : d
          )
        }));
      },

      executeDraw: async (drawId: string) => {
        const draw = get().draws.find(d => d.id === drawId);
        if (!draw || draw.status !== 'finalized') return;
        if (!draw.drand_round || !draw.drand_chain_hash) return;
        
        try {
          const { randomness, signature } = await simulateDrandRandomness(
            draw.drand_round,
            draw.drand_chain_hash
          );
          
          const winnerIndex = determineWinner(randomness, draw.participants.length);
          const winner = draw.participants[winnerIndex];
          
          set(state => ({
            draws: state.draws.map(d => 
              d.id === drawId 
                ? { 
                    ...d, 
                    status: 'completed' as DrawStatus,
                    randomness,
                    signature,
                    winner_id: winner.id,
                    completed_at: new Date().toISOString(),
                  }
                : d
            )
          }));
        } catch {
          set(state => ({
            draws: state.draws.map(d => 
              d.id === drawId 
                ? { ...d, status: 'failed' as DrawStatus }
                : d
            )
          }));
        }
      },

      getDraw: (id: string) => {
        return get().draws.find(d => d.id === id);
      },

      getAllDraws: () => {
        return get().draws;
      },
    }),
    {
      name: 'fairdraw-storage',
    }
  )
);
