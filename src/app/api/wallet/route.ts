import { load, flush } from "@/lib/store";
import { walletSnapshot, isSuiAddress } from "@/lib/sui";
import { remember, userNs, written } from "@/lib/memory";

export const dynamic = "force-dynamic";

// Reads a connected Sui wallet through Tatum's Sui RPC and remembers a short
// profile once, so the copilot knows how experienced the user is on-chain.
export async function GET(req: Request) {
  await load();
  const address = (new URL(req.url).searchParams.get("address") ?? "").toLowerCase();
  if (!isSuiAddress(address)) return Response.json({ error: "Not a Sui address" }, { status: 400 });
  try {
    const snap = await walletSnapshot(address);
    const ns = userNs(address);
    if (snap.live && !written(ns).some((m) => m.text.startsWith("User's Sui wallet"))) {
      const level = snap.recentTxs >= 15 ? "an active on-chain user" : snap.recentTxs > 0 ? "an occasional on-chain user" : "new to on-chain activity";
      await remember(ns, `User's Sui wallet holds ${snap.sui.toFixed(2)} SUI and is ${level} — explain things simply if new.`, false);
    }
    await flush();
    return Response.json(snap);
  } catch (e) {
    await flush();
    return Response.json({ error: e instanceof Error ? e.message : "Wallet read failed" }, { status: 502 });
  }
}
