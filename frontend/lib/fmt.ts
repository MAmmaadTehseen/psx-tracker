/** Format a large number with K / M / B suffix. */
export function fmtNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

/** Format a PKR currency value. */
export function fmtPKR(n: number, decimals = 0): string {
  return `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}

/** Format a price change with optional sign. */
export function fmtPct(n: number, showSign = true): string {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/** Format absolute + percent change together. */
export function fmtChange(change: number, changePct: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}  (${sign}${changePct.toFixed(2)}%)`;
}
