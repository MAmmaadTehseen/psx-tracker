/**
 * Global state using Zustand.
 *
 * Zustand is a tiny state manager (~1KB). You define a store as a function
 * that returns state + actions. Any component can subscribe and re-renders
 * only when the piece of state it uses changes.
 *
 * We use it for: auth state, active portfolio selection.
 * Server data (stocks, prices) stays in TanStack Query — not here.
 */

import { create } from 'zustand';
import type { AuthTokens } from './auth';

interface AuthState {
  tokens: AuthTokens | null;
  isLoggedIn: boolean;
  setTokens: (tokens: AuthTokens | null) => void;
}

interface PortfolioState {
  activePortfolioId: string | null;
  setActivePortfolio: (id: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  tokens: null,
  isLoggedIn: false,
  setTokens: (tokens) => set({ tokens, isLoggedIn: tokens !== null }),
}));

export const usePortfolioStore = create<PortfolioState>((set) => ({
  activePortfolioId: null,
  setActivePortfolio: (id) => set({ activePortfolioId: id }),
}));
