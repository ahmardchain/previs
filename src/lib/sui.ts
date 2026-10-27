import "server-only";

// Sui reads go through Tatum's RPC gateway. Used for:
//  - stamping every saved pick with the current Sui checkpoint (proof of time)
//  - reading a connected wallet's SUI balance and recent activity
const TATUM_KEY = process.env.TATUM_API_KEY;
const GATEWAY = process.env.TATUM_SUI_RPC || "https://sui-mainnet.gateway.tatum.io";

export const tatumLive = Boolean(TATUM_KEY);
export let lastTatumError: string | null = null;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-api-key": TATUM_KEY ?? "" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.text();
  let json: { result?: T; error?: { message: string } };
  try { json = JSON.parse(body); } catch { throw new Error(`Tatum RPC ${res.status}: ${body.slice(0, 160)}`); }
  if (!res.ok || json.error) throw new Error(json.error?.message || `Tatum RPC ${res.status}`);
  return json.result as T;
}

export async function latestCheckpoint(): Promise<string | null> {
  if (!tatumLive) return null;
  try {
    const r = await rpc<string>("sui_getLatestCheckpointSequenceNumber");
    lastTatumError = null;
    return r;
  } catch (e) {
    lastTatumError = e instanceof Error ? e.message : String(e);
    console.error("[tatum] checkpoint failed", e);
    return null;
  }
}

export async function checkpointTime(seq: string): Promise<string | null> {
  if (!tatumLive) return null;
  try {
    const cp = await rpc<{ timestampMs: string }>("sui_getCheckpoint", [seq]);
    return new Date(Number(cp.timestampMs)).toISOString();
  } catch {
    return null;
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
  const [bal, txs] = await Promise.all([
    rpc<{ totalBalance: string }>("suix_getBalance", [address, "0x2::sui::SUI"]),
    rpc<{ data: unknown[] }>("suix_queryTransactionBlocks", [{ filter: { FromAddress: address } }, null, 20, true]),
  ]);
  return { address, sui: Number(bal.totalBalance) / 1e9, recentTxs: txs.data.length, live: true };
}

export function isSuiAddress(a: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(a);
}
