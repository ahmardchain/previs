// Quick check that your Walrus Memory and Tatum keys work before you demo.
// Usage: node --env-file=.env.local scripts/check-keys.mjs
import { MemWal } from "@mysten-incubation/memwal";

const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => console.log(`✗ ${m}`);

if (process.env.TATUM_API_KEY) {
  try {
    const res = await fetch(process.env.TATUM_SUI_GRAPHQL || "https://sui-mainnet.gateway.tatum.io/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.TATUM_API_KEY },
      body: JSON.stringify({ query: "query { checkpoint { sequenceNumber } }" }),
    });
    const j = await res.json();
    j.data?.checkpoint ? ok(`Tatum Sui works — latest checkpoint ${j.data.checkpoint.sequenceNumber}`) : bad(`Tatum: ${JSON.stringify(j.errors ?? j)}`);
  } catch (e) { bad(`Tatum: ${e.message}`); }
} else bad("TATUM_API_KEY not set");

if (process.env.MEMWAL_KEY && process.env.MEMWAL_ACCOUNT_ID) {
  try {
    const m = MemWal.create({
      key: process.env.MEMWAL_KEY,
      accountId: process.env.MEMWAL_ACCOUNT_ID,
      serverUrl: process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
      namespace: `${process.env.MEMWAL_NAMESPACE || "previs"}-healthcheck`,
    });
    await m.health();
    ok("Walrus Memory relayer reachable");
    const r = await m.rememberAndWait(`Previs health check at ${new Date().toISOString()}`);
    ok(`Wrote a memory to Walrus — blob ${r.blob_id}`);
  } catch (e) { bad(`Walrus Memory: ${e.message}`); }
} else bad("MEMWAL_KEY / MEMWAL_ACCOUNT_ID not set");
