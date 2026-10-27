import { getMarket } from "@/lib/markets";
import { db, save, credibility, isOpen, shortId, type Side, load, flush } from "@/lib/store";
import { remember, userNs, CRED_NS } from "@/lib/memory";

export const dynamic = "force-dynamic";

// Settles a market and turns the result into memories:
//  - each player learns how their pick went (user namespace)
//  - each caller's credibility is updated (shared credibility namespace)
// Demo-only: in production this is driven by an oracle / results feed.
export async function POST(req: Request) {
  await load();
  const admin = process.env.PREVIS_ADMIN_KEY;
  if (admin && req.headers.get("x-admin-key") !== admin) return Response.json({ error: "Not allowed" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { marketId?: string; outcome?: Side; action?: string };
  const market = body.marketId ? getMarket(body.marketId) : undefined;

  // Demo-only: reopen a settled market so the demo can be run again. Already-graded
  // picks keep their result (and their memories); only new picks are graded next time.
  if (body.action === "reopen" && market) {
    db().resolutions = db().resolutions.filter((r) => r.marketId !== market.id);
    save();
    await flush();
    return Response.json({ marketId: market.id, reopened: true });
  }

  const outcome = body.outcome === "yes" || body.outcome === "no" ? body.outcome : null;
  if (!market || !outcome) return Response.json({ error: "Missing market or outcome" }, { status: 400 });
  if (!isOpen(market.id)) return Response.json({ error: "Already settled" }, { status: 409 });

  db().resolutions.push({ marketId: market.id, outcome, resolvedAt: new Date().toISOString() });
  const open = db().picks.filter((p) => p.marketId === market.id && p.status === "open");
  for (const p of open) p.status = p.side === outcome ? "won" : "lost";
  save();

  const writes: Promise<unknown>[] = [];
  for (const p of open) {
    const c = credibility(p.userId);
    const verdict = p.status === "won" ? "won" : "lost";
    if (p.source === "caller") {
      const name = db().callers.find((x) => x.id === p.userId)?.name ?? shortId(p.userId);
      writes.push(remember(CRED_NS,
        `${name} called ${p.side.toUpperCase()} on "${market.title}" (${market.league}) and was ${verdict === "won" ? "right" : "wrong"}. ` +
        `Now right ${c.wins} of ${c.total} (${Math.round(c.hitRate * 100)}%).`, false));
    } else {
      const pnl = verdict === "won" ? `+${(p.stake * (100 / (p.side === "yes" ? market.yes : 100 - market.yes)) - p.stake).toFixed(2)}` : `-${p.stake}`;
      writes.push(remember(userNs(p.userId),
        `User's ${p.side.toUpperCase()} pick on "${market.title}" (${market.league}) ${verdict} (${pnl} pUSD). ` +
        `User is now ${c.wins} of ${c.total} overall.`, false));
    }
  }
  await Promise.all(writes);
  await flush();
  return Response.json({ marketId: market.id, outcome, graded: open.length });
}
