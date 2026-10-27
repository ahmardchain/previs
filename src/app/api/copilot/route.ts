import { load, flush } from "@/lib/store";
import { ask } from "@/lib/copilot";
import { userIdFrom } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await load();
  const body = (await req.json().catch(() => ({}))) as { userId?: string; question?: string; marketId?: string };
  const userId = userIdFrom(body.userId);
  const question = String(body.question ?? "").slice(0, 2000);
  if (!userId) return Response.json({ error: "Missing user" }, { status: 400 });
  if (!question.trim() && !body.marketId) return Response.json({ error: "Ask something" }, { status: 400 });
  const reply = await ask(userId, question || "What's your pick?", body.marketId || undefined);
  await flush();
  return Response.json(reply);
}
