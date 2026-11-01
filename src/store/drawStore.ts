import { create } from 'zustand';
import { api } from '../lib/api';
import type { Draw, Participant, DrawStatus } from '../types';

interface DrawStore {
  draws: Draw[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Auth
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  
  // Draws
  loadDraws: () => Promise<void>;
  loadDraw: (id: string) => Promise<Draw | null>;
  createDraw: (title: string, description: string) => Promise<string>;
  addParticipant: (drawId: string, name: string, vk_url?: string) => Promise<void>;
  removeParticipant: (drawId: string, participantId: string) => Promise<void>;
  finalizeDraw: (drawId: string) => Promise<void>;
  executeDraw: (drawId: string) => Promise<void>;
  
  // Helpers
  getDraw: (id: string) => Draw | undefined;
  getAllDraws: () => Draw[];
  setError: (error: string | null) => void;
}

export const useDrawStore = create<DrawStore>()((set, get) => ({
  draws: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Auth
  login: async (password: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.login(password);
      set({ isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка входа', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
      set({ isAuthenticated: false, draws: [] });
    } catch (err) {
      console.error('Logout error:', err);
    }
  },

  checkAuth: async () => {
    try {
      const { authenticated } = await api.getAuthStatus();
      set({ isAuthenticated: authenticated });
      if (authenticated) {
        await get().loadDraws();
      }
    } catch (err) {
      console.error('Auth check error:', err);
    }
  },

  // Draws
  loadDraws: async () => {
    try {
      set({ isLoading: true, error: null });
      const draws = await api.getDraws();
      set({ draws, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка загрузки', isLoading: false });
    }
  },

  loadDraw: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const draw = await api.getDraw(id);
      
      // Обновляем в списке
      set(state => {
        const existingIndex = state.draws.findIndex(d => d.id === id);
        if (existingIndex >= 0) {
          const newDraws = [...state.draws];
          newDraws[existingIndex] = draw;
          return { draws: newDraws, isLoading: false };
        }
        return { draws: [...state.draws, draw], isLoading: false };
      });
      
      return draw;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка загрузки', isLoading: false });
      return null;
    }
  },

  createDraw: async (title: string, description: string) => {
    try {
      set({ isLoading: true, error: null });
      const draw = await api.createDraw(title, description);
      set(state => ({ draws: [draw, ...state.draws], isLoading: false }));
      return draw.id;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка создания', isLoading: false });
      throw err;
    }
  },

  addParticipant: async (drawId: string, name: string, vk_url?: string) => {
    try {
      set({ error: null });
      const draw = get().draws.find(d => d.id === drawId);
      if (!draw) throw new Error('Розыгрыш не найден');
      
      // Добавляем локально для быстрого UI
      const newParticipant: Participant = {
        id: Math.random().toString(36).substring(2, 8),
        name,
        vk_url,
        position: draw.participants.length + 1,
      };
      
      set(state => ({
        draws: state.draws.map(d => 
          d.id === drawId 
            ? { ...d, participants: [...d.participants, newParticipant] }
            : d
        )
      }));
      
      // Синхронизируем с сервером
      const updatedDraws = draw.participants.map(p => ({
        name: p.name,
        vk_url: p.vk_url,
      }));
      updatedDraws.push({ name, vk_url });
      
      await api.updateParticipants(drawId, updatedDraws);
      await get().loadDraw(drawId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка добавления' });
      await get().loadDraw(drawId);
    }
  },

  removeParticipant: async (drawId: string, participantId: string) => {
    try {
      set({ error: null });
      const draw = get().draws.find(d => d.id === drawId);
      if (!draw) throw new Error('Розыгрыш не найден');
      
      // Удаляем локально для быстрого UI
      set(state => ({
        draws: state.draws.map(d => 
          d.id === drawId 
            ? { 
                ...d, 
                participants: d.participants
                  .filter(p => p.id !== participantId)
                  .map((p, i) => ({ ...p, position: i + 1 }))
              }
            : d
        )
      }));
      
      // Синхронизируем с сервером
      const updatedDraws = draw.participants
        .filter(p => p.id !== participantId)
        .map(p => ({ name: p.name, vk_url: p.vk_url }));
      
      await api.updateParticipants(drawId, updatedDraws);
      await get().loadDraw(drawId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка удаления' });
      await get().loadDraw(drawId);
    }
  },

  finalizeDraw: async (drawId: string) => {
    try {
      set({ isLoading: true, error: null });
      const draw = await api.finalizeDraw(drawId);
      
      set(state => ({
        draws: state.draws.map(d => d.id === drawId ? draw : d),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка фиксации', isLoading: false });
      throw err;
    }
  },

  executeDraw: async (drawId: string) => {
    try {
      set({ isLoading: true, error: null });
      const draw = await api.executeDraw(drawId);
      
      set(state => ({
        draws: state.draws.map(d => d.id === drawId ? draw : d),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка розыгрыша', isLoading: false });
      throw err;
    }
  },

  // Helpers
  getDraw: (id: string) => {
    return get().draws.find(d => d.id === id);
  },

  getAllDraws: () => {
    return get().draws;
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
