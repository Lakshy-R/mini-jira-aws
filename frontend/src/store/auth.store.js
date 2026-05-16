import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// We store the user object and auth flag, but NOT the raw JWT.
// The token is fetched fresh from Amplify on every API call via api.js.
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => set({ user, isAuthenticated: true }),

      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);