const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // для cookies (сессии)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка запроса' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health() {
    return this.request<{ status: string }>('/health');
  }

  // Auth
  async login(password: string) {
    return this.request<{ success: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async logout() {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getAuthStatus() {
    return this.request<{ authenticated: boolean }>('/auth/status');
  }

  // Draws
  async getDraws() {
    return this.request<any[]>('/draws');
  }

  async getDraw(id: string) {
    return this.request<any>(`/draws/${id}`);
  }

  async createDraw(title: string, description: string) {
    return this.request<any>('/draws', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  async updateParticipants(drawId: string, participants: Array<{ name: string; vk_url?: string }>) {
    return this.request<any>(`/draws/${drawId}/participants`, {
      method: 'PUT',
      body: JSON.stringify({ participants }),
    });
  }

  async finalizeDraw(drawId: string) {
    return this.request<any>(`/draws/${drawId}/finalize`, {
      method: 'POST',
    });
  }

  async executeDraw(drawId: string) {
    return this.request<any>(`/draws/${drawId}/execute`, {
      method: 'POST',
    });
  }

  async verifyDraw(drawId: string) {
    return this.request<any>(`/draws/${drawId}/verify`);
  }
}

export const api = new ApiClient();
