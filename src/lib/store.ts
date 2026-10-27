import "server-only";
import fs from "node:fs";
import path from "node:path";
import { MARKETS } from "./markets";

// Structured app state (picks, scores). The *learning* — what the app knows
// about each user and caller — lives in Walrus Memory (see memory.ts). This
// file is the fast index the UI renders from.

export type Side = "yes" | "no";

export interface Pick {
  id: string;
  userId: string;
  marketId: string;
  side: Side;
  /** Probability the picker gave their side, 0–100. */
  confidence: number;
  stake: number;
  source: "user" | "copilot" | "caller";
  createdAt: string;
  /** Sui checkpoint read through Tatum at save time — proof the pick came first. */
  checkpoint?: string;
  /** Walrus blob that holds the remembered pick. */
  blobId?: string;
  fingerprint: string;
  status: "open" | "won" | "lost";
}

export interface Caller {
  id: string;
  name: string;
  bio: string;
}

export interface Resolution {
  marketId: string;
  outcome: Side;
  resolvedAt: string;
}

interface DB {
  picks: Pick[];
  callers: Caller[];
  resolutions: Resolution[];
  /** Local mirror of memories, used when Walrus keys aren't set. */
  memories: { namespace: string; text: string; createdAt: string; blobId: string }[];
}

const DIR = process.env.PREVIS_DATA_DIR || (process.env.VERCEL ? "/tmp/previs" : path.join(process.cwd(), ".data"));
const FILE = path.join(DIR, "store.json");

let cache: DB | null = null;

function seed(): DB {
  const callers: Caller[] = [
    { id: "caller:copilot", name: "Previs AI Copilot", bio: "The house AI. Every call saved before the event." },
    { id: "caller:lagos-quant", name: "lagos-quant", bio: "Model-driven football picks." },
    { id: "caller:0x7a3e", name: "0x7a3e…41c2", bio: "Crypto swing trader." },
    { id: "caller:hype-hunter", name: "hype-hunter", bio: "Loud, confident, often early." },
    { id: "caller:steady-eddie", name: "steady-eddie", bio: "Small edges, lots of them." },
  ];
  // Seeded track records so credibility scores mean something on day one.
  const record: Record<string, [number, number]> = {
    "caller:copilot": [26, 15],
    "caller:lagos-quant": [19, 12],
    "caller:0x7a3e": [24, 13],
    "caller:hype-hunter": [31, 11],
    "caller:steady-eddie": [14, 9],
  };
  const picks: Pick[] = [];
  let n = 0;
  const past = Date.UTC(2026, 8, 1);
  for (const [cid, [total, wins]] of Object.entries(record)) {
    for (let i = 0; i < total; i++) {
      picks.push({
        id: `seed-${n++}`,
        userId: cid,
        marketId: `past-${i}`,
        side: i % 2 ? "yes" : "no",
        confidence: 60,
        stake: 0,
        source: "caller",
        createdAt: new Date(past + i * 86400000).toISOString(),
        fingerprint: "seed",
        status: i < wins ? "won" : "lost",
      });
    }
  }
  // Open calls on today's markets.
  const open: [string, string, Side, number][] = [
    ["caller:lagos-quant", "ars-che", "yes", 62], ["caller:hype-hunter", "ars-che", "no", 80],
    ["caller:0x7a3e", "btc-120k", "no", 61], ["caller:hype-hunter", "btc-120k", "yes", 85],
    ["caller:steady-eddie", "lal-8", "no", 58], ["caller:0x7a3e", "sol-250", "no", 70],
    ["caller:lagos-quant", "ngr-wcq", "yes", 69], ["caller:steady-eddie", "ngr-wcq", "yes", 64],
    ["caller:hype-hunter", "sui-5", "yes", 75], ["caller:0x7a3e", "sui-5", "no", 60],
    ["caller:lagos-quant", "mci-liv", "no", 55], ["caller:steady-eddie", "eth-btc", "yes", 54],
  ];
  for (const [cid, mid, side, conf] of open) {
    picks.push({
      id: `seed-${n++}`, userId: cid, marketId: mid, side, confidence: conf, stake: 0,
      source: "caller", createdAt: new Date(Date.UTC(2026, 9, 26)).toISOString(), fingerprint: "seed", status: "open",
    });
  }
  return { picks, callers, resolutions: [], memories: [] };
}

interface KV { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }
const KV_KEY = "previs:db:v1";
let dirty = false;

async function kv(): Promise<KV | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return ((ctx.env as Record<string, unknown>).PREVIS_KV as KV) ?? null;
  } catch {
    return null; // plain `next dev` / `next start`: use the local file
  }
}

/** Call at the start of every API request. On Workers this pulls the latest state from KV. */
export async function load(): Promise<DB> {
  const store = await kv();
  if (store) {
    const raw = await store.get(KV_KEY);
    cache = raw ? (JSON.parse(raw) as DB) : seed();
    if (!raw) dirty = true;
    return cache;
  }
  return db();
}

/** Call after mutating requests. Writes to KV on Workers (the file is written in save()). */
export async function flush() {
  if (!dirty) return;
  const store = await kv();
  if (store && cache) {
    // Keep KV values comfortably small: the memory mirror only needs recent entries.
    if (cache.memories.length > 2000) cache.memories = cache.memories.slice(-2000);
    await store.put(KV_KEY, JSON.stringify(cache));
  }
  dirty = false;
}

export function db(): DB {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    cache = seed();
    save();
  }
  return cache;
}

export function save() {
  if (!cache) return;
  dirty = true;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Read-only filesystem (Workers): KV via flush() is the store.
  }
}

/** Credibility = smoothed hit rate, so 2/2 doesn't outrank 60/100. */
export function credibility(userId: string) {
  const resolved = db().picks.filter((p) => p.userId === userId && p.status !== "open");
  const wins = resolved.filter((p) => p.status === "won").length;
  const total = resolved.length;
  const score = (wins + 2) / (total + 4);
  return { wins, total, score, hitRate: total ? wins / total : 0 };
}

export function leaderboard() {
  const ids = new Set<string>(db().callers.map((c) => c.id));
  for (const p of db().picks) if (p.source !== "caller") ids.add(p.userId);
  return [...ids]
    .map((id) => {
      const c = db().callers.find((x) => x.id === id);
      return { id, name: c?.name ?? shortId(id), ...credibility(id) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.score - a.score);
}

export function shortId(id: string) {
  return id.startsWith("0x") && id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id.replace(/^caller:/, "");
}

export function isOpen(marketId: string) {
  return !db().resolutions.some((r) => r.marketId === marketId) && MARKETS.some((m) => m.id === marketId);
}
