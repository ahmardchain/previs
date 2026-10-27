import { listMarkets } from "@/lib/markets";
import { quickPick } from "@/lib/copilot";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = new Map(db().resolutions.map((r) => [r.marketId, r.outcome]));
  return Response.json(
    listMarkets().map((m) => ({ ...m, pick: quickPick(m), resolved: resolved.get(m.id) ?? null })),
  );
}
