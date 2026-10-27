import "server-only";

// Sui reads go through Tatum's RPC gateway. Used for:
//  - stamping every saved pick with the current Sui checkpoint (proof of time)
//  - reading a connected wallet's SUI balance and recent activity
const TATUM_KEY = process.env.TATUM_API_KEY;
// Sui deprecated JSON-RPC; Tatum's Sui gateway now serves GraphQL at /graphql.
const GRAPHQL = process.env.TATUM_SUI_GRAPHQL || "https://sui-mainnet.gateway.tatum.io/graphql";

export const tatumLive = Boolean(TATUM_KEY);
export let lastTatumError: string | null = null;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-api-key": TATUM_KEY ?? "" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.text();
  let json: { data?: T; errors?: { message: string }[]; message?: string };
  try { json = JSON.parse(body); } catch { throw new Error(`Tatum ${res.status}: ${body.slice(0, 160)}`); }
  if (!res.ok || json.errors?.length || !json.data) {
    throw new Error(`Tatum ${res.status}: ${json.errors?.[0]?.message ?? json.message ?? body.slice(0, 160)}`);
  }
  return json.data;
}

// Free Tatum plans are rate-limited, so reuse a checkpoint for a few seconds.
let cpCache: { seq: string; at: number } | null = null;

export async function latestCheckpoint(): Promise<string | null> {
  if (!tatumLive) return null;
  if (cpCache && Date.now() - cpCache.at < 5000) return cpCache.seq;
  try {
    const d = await gql<{ checkpoint: { sequenceNumber: number | string } }>("query { checkpoint { sequenceNumber } }");
    const seq = String(d.checkpoint.sequenceNumber);
    cpCache = { seq, at: Date.now() };
    lastTatumError = null;
    return seq;
  } catch (e) {
    lastTatumError = e instanceof Error ? e.message : String(e);
    console.error("[tatum] checkpoint failed", e);
    return cpCache?.seq ?? null;
  }
}

export interface WalletSnapshot {
  address: string;
  sui: number;
  recentTxs: number;
  live: boolean;
}

export async function walletSnapshot(address: string): Promise<WalletSnapshot> {
  if (!tatumLive) return { address, sui: 0, recentTxs: 0, live: false };
  const d = await gql<{
    address: { balance: { totalBalance: string } | null } | null;
    transactions: { nodes: unknown[] };
  }>(
    `query($a: SuiAddress!) {
      address(address: $a) { balance(coinType: "0x2::sui::SUI") { totalBalance } }
      transactions(last: 20, filter: { sentAddress: $a }) { nodes { digest } }
    }`,
    { a: address },
  );
  const total = Number(d.address?.balance?.totalBalance ?? 0);
  return { address, sui: total / 1e9, recentTxs: d.transactions.nodes.length, live: true };
}

export function isSuiAddress(a: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(a);
}
