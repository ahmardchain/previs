import { remember, written, userNs, walrusLive, totalWritten } from "@/lib/memory";
import { userIdFrom } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = userIdFrom(new URL(req.url).searchParams.get("userId"));
  const mine = userId ? written(userNs(userId)) : [];
  return Response.json({
    mode: walrusLive ? "mainnet" : "demo",
    total: totalWritten(),
    memories: mine.map((m) => ({ text: m.text, blobId: m.blobId, createdAt: m.createdAt })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: string; text?: string };
  const userId = userIdFrom(body.userId);
  const text = String(body.text ?? "").trim().slice(0, 300);
  if (!userId || text.length < 3) return Response.json({ error: "Missing user or text" }, { status: 400 });
  const r = await remember(userNs(userId), `User says: ${text}`);
  return Response.json(r);
}
