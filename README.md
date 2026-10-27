# Previs — every call, on the record

Previs is a paper-trading prediction market for sports and crypto, with a copilot that **remembers how you trade** and **saves every pick before the result**.

Built for **Total Recall — Tatum × Walrus Memory Hackathon**, track *Markets & Sports Prediction*.

## What it does

- **Simple copilot.** Pick any market and ask. You get one clear pick (Yes/No), a confidence label, short reasons, and how much to put in.
- **Memory that changes the answer.** Tell it "my limit is 3% per trade" or "I support Arsenal", make picks, watch results come in. Every one of those becomes a Walrus memory, and the copilot's next answer shows a **"Because I remember…"** box explaining exactly what changed (smaller size after a losing streak, a warning when you're betting on your own team, a lesson from your last pick in that league).
- **Receipts.** Saving a pick writes it to Walrus Memory *before* the event and stamps it with the current **Sui checkpoint, read through Tatum's Sui RPC**, plus a SHA-256 fingerprint. It can't be quietly edited later.
- **Who to trust.** Every caller (including the copilot itself) is graded only on picks saved before the result. Credibility scores feed back into the copilot, and each result is written to a shared credibility memory, so Previs learns who is worth listening to.
- **Pick journal.** The Portfolio page shows your record, open picks with their receipts, and everything the copilot remembers about you.

## How it uses Walrus Memory

| Namespace | What's written | When | How it's used |
|---|---|---|---|
| `previs-u-<hash>` (one per user) | Risk limits, teams you support, every pick, every result | You tell the copilot something · you save/place a pick · a market settles | Recalled before every answer to size the bet and write the "Because I remember" lines |
| `previs-credibility` | "<caller> called YES on … and was right. Now right 15 of 27." | A market settles | Recalled to decide whose calls to trust |

Code: [`src/lib/memory.ts`](src/lib/memory.ts) (remember/recall), [`src/lib/copilot.ts`](src/lib/copilot.ts) (how memories change advice), [`src/app/api/resolve/route.ts`](src/app/api/resolve/route.ts) (learning from results).

## How it uses Tatum (Sui Mainnet gateway)

Sui has deprecated JSON-RPC, so Previs queries Tatum's Sui gateway over **GraphQL** (`https://sui-mainnet.gateway.tatum.io/graphql`, `x-api-key` header):

- `checkpoint { sequenceNumber }` — stamps every receipt with the latest Sui checkpoint at save time (proof the pick came first).
- `address { balance(coinType: "0x2::sui::SUI") }` + `transactions(filter: { sentAddress })` — when you connect a Sui address, Previs reads your SUI balance and recent activity and remembers your experience level, so the copilot can explain things more simply to newcomers.

Code: [`src/lib/sui.ts`](src/lib/sui.ts).

## Run it

```bash
npm install
cp .env.example .env.local   # add MEMWAL_KEY, MEMWAL_ACCOUNT_ID, TATUM_API_KEY
node --env-file=.env.local scripts/check-keys.mjs   # confirms both keys work and writes 1 memory
npm run dev
```

Without keys the app still runs in **demo mode** (memories go to a local file, no checkpoints). The header shows which mode is live.

## Deploy to Cloudflare Workers

The app runs on Workers through the OpenNext adapter. Picks and scores persist in a KV namespace (`PREVIS_KV`, already in `wrangler.jsonc`); the learning lives in Walrus Memory.

**From the dashboard (auto-deploys on every push):** Workers & Pages → Create → Import a repository → `previs`.
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Settings → Variables and Secrets → add `MEMWAL_KEY`, `MEMWAL_ACCOUNT_ID`, `TATUM_API_KEY` (and optionally `ANTHROPIC_API_KEY`, `PREVIS_ADMIN_KEY`) as **secrets**.

**From your machine:** `npx wrangler login`, then `npm run deploy`. Add secrets with `npx wrangler secret put MEMWAL_KEY` (repeat for each).

## Demo script (3 minutes)

1. **Copilot** → type `My limit is 3% per trade` → "Remembered" chip appears.
2. Type `I support Arsenal`.
3. Choose *Arsenal beat Chelsea* → `What's your pick?` → note the **Because I remember** box (limit + team warning) → **Save my pick** → receipt with Sui checkpoint + Walrus blob.
4. Open a BTC market → place a paper trade.
5. **Portfolio** → settle both markets as losses → open the copilot on another football market → it now says you've lost twice and keeps the size small, and cites your last football result.
6. **Markets** → leaderboard has moved; the copilot's own record updated.

That flow writes 10+ memories to Walrus Mainnet.

## Stack

Next.js 16 (App Router) on Cloudflare Workers (OpenNext + KV) · TypeScript · `@mysten-incubation/memwal` · Tatum Sui RPC gateway · Cloudflare Workers AI (free tier, Gemma 4) phrases AI Copilot replies — numbers always come from Previs's own logic, and any reply that changes a number is discarded.

## Hackathon checklist

- [x] Walrus Memory integrated, writing on Mainnet (`MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz`)
- [x] Tatum Sui RPC for on-chain data
- [ ] 10+ memories on Mainnet — run the demo script once with real keys
- [ ] Blog post — draft in [`BLOG.md`](BLOG.md)
- [ ] Working demo (deploy) + public repo

Markets and odds are demo data for paper trading. No real money is used.
