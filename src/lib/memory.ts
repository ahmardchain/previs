import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { MemWal } from "@mysten-incubation/memwal";
import { db, save } from "./store";

// Walrus Memory is Previs's learning layer:
//  - user:<id>       habits, limits, favourite markets, lessons from results
//  - credibility     who has been right, so the copilot knows whom to trust
// When MEMWAL_* env vars are missing, the same calls hit a local mirror so the
// demo still runs — the UI shows which mode is live.

const KEY = process.env.MEMWAL_KEY;
const ACCOUNT = process.env.MEMWAL_ACCOUNT_ID;
const SERVER = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
const BASE_NS = process.env.MEMWAL_NAMESPACE || "previs";

export const walrusLive = Boolean(KEY && ACCOUNT);

let client: MemWal | null = null;
function memwal(): MemWal {
  if (!client) client = MemWal.create({ key: KEY!, accountId: ACCOUNT!, serverUrl: SERVER, namespace: BASE_NS });
  return client;
}

export function userNs(userId: string) {
  // Namespaces stay short and safe for any user id (wallet address or guest id).
  return `${BASE_NS}-u-${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;
}
export const CRED_NS = `${BASE_NS}-credibility`;

export interface Memory {
  text: string;
  blobId: string;
  createdAt?: string;
  relevance?: number;
}

export async function remember(namespace: string, text: string, wait = false): Promise<{ blobId: string; live: boolean }> {
  if (walrusLive) {
    try {
      const m = memwal();
      if (wait) {
        const r = await m.rememberAndWait(text, namespace, { timeoutMs: 45000 });
        mirror(namespace, text, r.blob_id);
        return { blobId: r.blob_id, live: true };
      }
      const job = await m.remember(text, namespace);
      mirror(namespace, text, `pending:${job.job_id}`);
      return { blobId: `pending:${job.job_id}`, live: true };
    } catch (e) {
      console.error("[walrus] remember failed, using local mirror", e);
    }
  }
  const blobId = `local-${randomUUID().slice(0, 8)}`;
  mirror(namespace, text, blobId);
  return { blobId, live: false };
}

function mirror(namespace: string, text: string, blobId: string) {
  db().memories.push({ namespace, text, blobId, createdAt: new Date().toISOString() });
  save();
}

export async function recall(namespace: string, query: string, limit = 6): Promise<Memory[]> {
  if (walrusLive) {
    try {
      const r = await memwal().recall({ query, limit, namespace });
      const found = r.results.map((x) => ({ text: x.text, blobId: x.blob_id, relevance: 1 - x.distance }) as Memory);
      // Walrus indexes in the background; include what we wrote in the last few
      // minutes so a fact the user just told us is used straight away.
      const seen = new Set(found.map((m) => m.text));
      const cutoff = Date.now() - 10 * 60 * 1000;
      const fresh = db().memories
        .filter((m) => m.namespace === namespace && !seen.has(m.text) && Date.parse(m.createdAt) > cutoff)
        .map((m) => ({ text: m.text, blobId: m.blobId, createdAt: m.createdAt }));
      return [...fresh, ...found].slice(0, limit + fresh.length);
    } catch (e) {
      console.error("[walrus] recall failed, using local mirror", e);
    }
  }
  // Local fallback: keyword overlap ranking.
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  return db()
    .memories.filter((m) => m.namespace === namespace)
    .map((m) => ({ m, s: words.filter((w) => m.text.toLowerCase().includes(w)).length + 0.01 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ m }) => ({ text: m.text, blobId: m.blobId, createdAt: m.createdAt }));
}

/** Everything Previs has written for this namespace, newest first (from the mirror). */
export function written(namespace: string) {
  return db()
    .memories.filter((m) => m.namespace === namespace)
    .slice()
    .reverse();
}

export function totalWritten() {
  return db().memories.length;
}

export function fingerprint(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/** Fill in Walrus blob ids for memories that were written asynchronously. */
export async function resolvePending(namespace?: string, max = 8): Promise<boolean> {
  if (!walrusLive) return false;
  const pending = db().memories.filter((m) => m.blobId.startsWith("pending:") && (!namespace || m.namespace === namespace)).slice(-max);
  if (!pending.length) return false;
  let changed = false;
  await Promise.all(
    pending.map(async (m) => {
      try {
        const s = await memwal().getRememberStatus(m.blobId.slice("pending:".length));
        if (s.blob_id) { m.blobId = s.blob_id; changed = true; }
        else if (s.status === "failed" || s.status === "not_found") { m.blobId = `failed:${m.blobId.slice(8)}`; changed = true; }
      } catch { /* try again next time */ }
    }),
  );
  if (changed) {
    for (const p of db().picks) {
      if (p.blobId?.startsWith("pending:")) {
        const hit = db().memories.find((m) => m.text && p.fingerprint === fingerprint(m.text));
        if (hit && !hit.blobId.startsWith("pending:")) p.blobId = hit.blobId;
      }
    }
    save();
  }
  return changed;
}
