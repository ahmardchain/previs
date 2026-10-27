import { leaderboard } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    leaderboard().map((r) => ({ ...r, hitRate: Math.round(r.hitRate * 100), score: Math.round(r.score * 100) })),
  );
}
