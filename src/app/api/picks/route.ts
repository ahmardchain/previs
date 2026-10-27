import { randomUUID } from "node:crypto";
import { getMarket } from "@/lib/markets";
import { db, save, isOpen, type Pick, type Side, load, flush } from "@/lib/store";
import { remember, userNs, fingerprint } from "@/lib/memory";
import { latestCheckpoint } from "@/lib/sui";
import { BALANCE } from "@/lib/copilot";
import { userIdFrom } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await load();
  const userId = userIdFrom(new URL(req.url).searchParams.get("userId"));
  if (!userId) return Response.json([]);
  const picks = db().picks.filter((p) => p.userId === userId).slice().reverse();
  await flush();
  return Response.json(picks.map((p) => ({ ...p, marketTitle: getMarket(p.marketId)?.title ?? p.marketId })));
}

export async function POST(req: Request) {
  await load();
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string; marketId?: string; side?: Side; stake?: number; confidence?: number; source?: "user" | "copilot";
  };
  const userId = userIdFrom(body.userId);
  const market = body.marketId ? getMarket(body.marketId) : undefined;
  const side = body.side === "yes" || body.side === "no" ? body.side : null;
  const stake = Math.round(Number(body.stake) * 100) / 100;
  if (!userId || !market || !side) return Response.json({ error: "Missing user, market or side" }, { status: 400 });
  if (!isOpen(market.id)) return Response.json({ error: "This market is already settled" }, { status: 409 });
  if (!(stake > 0 && stake <= BALANCE)) return Response.json({ error: `Stake must be between 0 and ${BALANCE}` }, { status: 400 });

  const spent = db().picks.filter((p) => p.userId === userId && p.status === "open").reduce((s, p) => s + p.stake, 0);
  if (spent + stake > BALANCE) return Response.json({ error: "Not enough paper balance" }, { status: 400 });

  const price = side === "yes" ? market.yes : 100 - market.yes;
  const confidence = Math.max(1, Math.min(99, Math.round(Number(body.confidence) || price)));
  const createdAt = new Date().toISOString();
  const checkpoint = await latestCheckpoint();
  const sideWord = side.toUpperCase();
  const source = body.source === "copilot" ? "copilot" : "user";

  // The memory text is the receipt. Its fingerprint is shown publicly so the
  // pick can't be quietly edited after the event.
  const text =
    `On ${createdAt.slice(0, 10)} the user picked ${sideWord} on "${market.title}" (${market.league}) ` +
    `with ${stake} pUSD at ${price}¢${source === "copilot" ? ", following the copilot's call" : ""}.` +
    (checkpoint ? ` Saved at Sui checkpoint ${checkpoint}.` : "");
  const fp = fingerprint(text);
  const { blobId } = await remember(userNs(userId), text);

  const pick: Pick = {
    id: randomUUID(), userId, marketId: market.id, side, confidence, stake, source,
    createdAt, checkpoint: checkpoint ?? undefined, blobId, fingerprint: fp, status: "open",
  };
  db().picks.push(pick);
  // Saving a copilot call also puts the copilot itself on the record, so its
  // public track record is graded like everyone else's.
  if (source === "copilot" && !db().picks.some((p) => p.userId === "caller:copilot" && p.marketId === market.id)) {
    db().picks.push({ ...pick, id: randomUUID(), userId: "caller:copilot", stake: 0, source: "caller" });
  }
  save();
  await flush();
  return Response.json({ ...pick, marketTitle: market.title, receipt: text });
}
