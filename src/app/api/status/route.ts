import { load, flush } from "@/lib/store";
import { walrusLive, totalWritten } from "@/lib/memory";
import { tatumLive, latestCheckpoint, lastTatumError } from "@/lib/sui";
import { lastAiNote } from "@/lib/copilot";

export const dynamic = "force-dynamic";

export async function GET() {
  await load();
  await flush();
  const checkpoint = await latestCheckpoint();
  return Response.json({
    walrus: walrusLive ? "mainnet" : "demo",
    tatum: tatumLive ? "live" : "demo",
    checkpoint,
    tatumError: lastTatumError,
    aiNote: lastAiNote,
    memoriesWritten: totalWritten(),
  });
}
