// Demo market catalogue. Prices are paper-trading odds; swap `MARKETS` for a
// live odds feed in production. Every other part of the app reads markets
// through `getMarket` / `listMarkets`, so that's the only seam to change.

export type Category = "Sports" | "Crypto";

export interface Market {
  id: string;
  icon: string;
  category: Category;
  league: string;
  title: string;
  /** Market's current Yes price in cents (0–100). */
  yes: number;
  move24h: number;
  volume: number;
  closesAt: string; // ISO
  live?: boolean;
  /** Price history used for the chart, oldest first. */
  history: number[];
}

const DAY = 24 * 60 * 60 * 1000;
const from = (days: number) => new Date(Date.UTC(2026, 9, 27) + days * DAY).toISOString();

function series(end: number, wobble: number, seed: number): number[] {
  const out: number[] = [];
  let v = end - wobble * 1.4;
  let s = seed;
  for (let i = 0; i < 24; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.45;
    v = Math.max(3, Math.min(97, v + r * wobble * 0.5 + (end - v) * 0.08));
    out.push(Math.round(v * 10) / 10);
  }
  out[out.length - 1] = end;
  return out;
}

export const MARKETS: Market[] = [
  { id: "ars-che", icon: "EPL", category: "Sports", league: "Football", title: "Arsenal beat Chelsea on Saturday?", yes: 58, move24h: 4, volume: 42100, closesAt: from(4), history: series(58, 8, 11) },
  { id: "btc-120k", icon: "BTC", category: "Crypto", league: "Weekly close", title: "BTC closes the week above $120k?", yes: 44, move24h: -2.5, volume: 88400, closesAt: from(5), history: series(44, 9, 23) },
  { id: "lal-8", icon: "NBA", category: "Sports", league: "Basketball", title: "Lakers win by 8+ tonight?", yes: 39, move24h: 1, volume: 9600, closesAt: from(0.4), live: true, history: series(39, 7, 31) },
  { id: "sol-250", icon: "SOL", category: "Crypto", league: "Price target", title: "SOL flips $250 before Nov 10?", yes: 31, move24h: -0.5, volume: 27000, closesAt: from(14), history: series(31, 6, 47) },
  { id: "ngr-wcq", icon: "AFC", category: "Sports", league: "Football", title: "Super Eagles win their next qualifier?", yes: 67, move24h: 3, volume: 15800, closesAt: from(18), history: series(67, 7, 53) },
  { id: "sui-5", icon: "SUI", category: "Crypto", league: "Price target", title: "SUI trades above $5 on Nov 30?", yes: 36, move24h: 1.5, volume: 19400, closesAt: from(34), history: series(36, 8, 61) },
  { id: "mci-liv", icon: "EPL", category: "Sports", league: "Football", title: "Man City beat Liverpool on Sunday?", yes: 47, move24h: -1, volume: 33800, closesAt: from(5), history: series(47, 6, 71) },
  { id: "eth-btc", icon: "ETH", category: "Crypto", league: "Monthly", title: "ETH/BTC ratio up on the month?", yes: 52, move24h: 0.2, volume: 12300, closesAt: from(34), history: series(52, 5, 83) },
];

export function listMarkets(): Market[] {
  return MARKETS;
}

export function getMarket(id: string): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

export function formatVolume(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
}

export function formatCloses(m: Market): string {
  if (m.live) return "Live";
  const d = new Date(m.closesAt);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
