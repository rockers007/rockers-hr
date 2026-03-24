import { create } from 'zustand';
import type { User, AdminUser } from './types';
import { api } from './api';

function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;

  fetchUser: () => Promise<void>;
  initAuth: () => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setAdminUser: (admin: AdminUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  adminUser: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  initAuth: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    const payload = parseJwt(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      localStorage.removeItem('token');
      set({ isLoading: false });
      return;
    }
    if (payload.is_admin) {
      set({
        adminUser: {
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          admin_role_id: payload.admin_role_id,
          is_admin: true,
        } as AdminUser,
        isAdmin: true,
        isLoading: false,
      });
    } else if (payload.is_active) {
      // Regular user — fetch full profile
      api.get<User>('/users/me')
        .then((user) => set({ user, isAuthenticated: true, isLoading: false }))
        .catch(() => {
          localStorage.removeItem('token');
          set({ isLoading: false });
        });
    } else {
      set({ isLoading: false });
    }
  },

  fetchUser: async () => {
    try {
      const user = await api.get<User>('/users/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    } finally {
      localStorage.removeItem('token');
      set({ user: null, adminUser: null, isAuthenticated: false, isAdmin: false });
    }
  },

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  setAdminUser: (adminUser) =>
    set({ adminUser, isAdmin: !!adminUser, isLoading: false }),
}));
