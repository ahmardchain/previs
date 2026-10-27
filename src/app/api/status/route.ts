import { walrusLive, totalWritten } from "@/lib/memory";
import { tatumLive, latestCheckpoint } from "@/lib/sui";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    walrus: walrusLive ? "mainnet" : "demo",
    tatum: tatumLive ? "live" : "demo",
    checkpoint: await latestCheckpoint(),
    memoriesWritten: totalWritten(),
  });
}
