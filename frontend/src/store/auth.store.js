import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth store.
 * Stores the enriched user object (with role + teamId extracted from the Cognito ID token).
 * The raw JWT is never persisted here — Amplify manages tokens and refreshes them.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      // user should contain: { userId, username, email, role, teamId, sub }
      setAuth: (user) => set({ user, isAuthenticated: true }),

      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'mini-jira-auth',
      // Only persist essential, non-sensitive fields
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
