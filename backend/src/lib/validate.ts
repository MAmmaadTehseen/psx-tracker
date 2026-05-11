import { response } from './db';

export function parseBody(event: any): { ok: true; body: any } | { ok: false; res: ReturnType<typeof response> } {
  try {
    const body = JSON.parse(event.body ?? '{}');
    return { ok: true, body };
  } catch {
    return { ok: false, res: response(400, { error: 'Invalid JSON body' }) };
  }
}

// YYYY-MM-DD, rejects things like Feb 30
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

// Safe parseInt with default and max cap — guards against NaN and absurd values
export function parseDays(raw: string | undefined, def: number, max: number): number {
  const n = parseInt(raw ?? String(def), 10);
  if (isNaN(n) || n <= 0) return def;
  return Math.min(n, max);
}

// PSX tickers: 1–10 uppercase alphanumeric chars (ENGRO, MCB, LUCK, etc.)
export function isValidTicker(t: string): boolean {
  return /^[A-Z0-9]{1,10}$/.test(t);
}

export function internalError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return response(500, { error: 'Internal server error', detail: msg });
}
