/**
 * API client — all HTTP calls to the backend live here.
 *
 * Every protected call includes the Cognito AccessToken in the Authorization header.
 * API Gateway validates the token before the Lambda even runs.
 */

import { getTokens } from './auth';
import { CONFIG } from './config';

const BASE = CONFIG.API_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const tokens = await getTokens();
  if (!tokens) return {};
  return { Authorization: tokens.accessToken };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Market ──────────────────────────────────────────────────────────────────

export const api = {
  // Public — no auth needed
  getStocks: (sector?: string) =>
    request<{ stocks: StockMetadata[] }>(
      `/stocks${sector ? `?sector=${sector}` : ''}`
    ),

  getStock: (ticker: string, days = 30) =>
    request<{ stock: StockMetadata; prices: StockPrice[] }>(
      `/stocks/${ticker}?days=${days}`
    ),

  getDividends: (ticker: string) =>
    request<{ ticker: string; dividends: Dividend[] }>(
      `/stocks/${ticker}/dividends`
    ),

  // Protected — require Cognito token
  getPortfolios: async () => {
    const headers = await authHeaders();
    return request<{ portfolios: Portfolio[] }>('/portfolio', { headers });
  },

  getPortfolio: async (portfolioId: string) => {
    const headers = await authHeaders();
    return request<{ portfolioId: string; holdings: Holding[]; trades: Trade[] }>(
      `/portfolio?portfolioId=${portfolioId}`,
      { headers }
    );
  },

  addTrade: async (trade: Omit<Trade, 'tradeId' | 'userId' | 'createdAt'>) => {
    const headers = await authHeaders();
    return request<{ tradeId: string; message: string }>('/portfolio/trade', {
      method: 'POST',
      headers,
      body: JSON.stringify(trade),
    });
  },

  deleteTrade: async (tradeId: string, portfolioId: string) => {
    const headers = await authHeaders();
    return request<{ message: string }>(
      `/portfolio/trade/${tradeId}?portfolioId=${portfolioId}`,
      { method: 'DELETE', headers }
    );
  },

  getUploadUrl: async (filename: string) => {
    const headers = await authHeaders();
    return request<{ uploadUrl: string; key: string }>(
      `/upload-url?filename=${filename}`,
      { headers }
    );
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockMetadata {
  ticker: string;
  name: string;
  sector: string;
  marketCap?: number;
  pe?: number;
  eps?: number;
}

export interface StockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePct: number;
}

export interface Dividend {
  exDate: string;
  announceDate: string;
  payDate: string;
  amount: number;
  type: 'cash' | 'bonus' | 'right';
}

export interface Portfolio {
  portfolioId: string;
  name: string;
  createdAt: string;
}

export interface Trade {
  tradeId: string;
  portfolioId: string;
  userId: string;
  ticker: string;
  type: 'buy' | 'sell';
  date: string;
  quantity: number;
  pricePerShare: number;
  brokerage: number;
  createdAt: string;
}

export interface Holding {
  ticker: string;
  qty: number;
  avgCostPerShare: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  realizedGain: number;
}
