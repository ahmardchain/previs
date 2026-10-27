import "server-only";
import { getMarket, listMarkets, type Market } from "./markets";
import { credibility, db, shortId, type Side } from "./store";
import { recall, remember, userNs, CRED_NS, type Memory } from "./memory";

export const BALANCE = 1000; // paper pUSD every user starts with

export interface Advice {
  marketId: string;
  marketTitle: string;
  side: Side;
  /** Copilot's probability for its side, 0–100. */
  confidence: number;
  label: "Fairly sure" | "Leaning" | "Close call";
  reasons: string[];
  /** Lines that exist only because of something Previs remembers. */
  because: string[];
  amount: number;
  callers: { name: string; side: Side; hitRate: number; total: number }[];
  memoriesUsed: Memory[];
}

export interface CopilotReply {
  text: string;
  advice?: Advice;
  learned?: string;
  suggestions: string[];
}

function userStats(userId: string) {
  const mine = db().picks.filter((p) => p.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const resolved = mine.filter((p) => p.status !== "open");
  let lossStreak = 0;
  for (let i = resolved.length - 1; i >= 0 && resolved[i].status === "lost"; i--) lossStreak++;
  return { picks: mine.length, resolved: resolved.length, wins: resolved.filter((p) => p.status === "won").length, lossStreak };
}

function parseLimitPct(mems: Memory[]): number | null {
  for (const m of mems) {
    const hit = m.text.match(/(?:limit|max(?:imum)?)[^0-9]{0,30}(\d{1,2}(?:\.\d)?)\s*%/i);
    if (hit) return Number(hit[1]);
  }
  return null;
}

export async function advise(userId: string, market: Market): Promise<Advice> {
  const [mine, cred] = await Promise.all([
    recall(userNs(userId), `habits risk limit favourite teams results on ${market.title}`, 8),
    recall(CRED_NS, `who is reliable on ${market.league} ${market.category}`, 5),
  ]);

  // 1) What do proven callers say? Weight each call by their track record.
  const calls = db().picks.filter((p) => p.marketId === market.id && p.source === "caller" && p.status === "open");
  let wSum = 0;
  let wYes = 0;
  const callers = calls.map((p) => {
    const c = credibility(p.userId);
    const w = Math.max(0, c.score - 0.42) * Math.sqrt(c.total);
    const pYes = p.side === "yes" ? p.confidence : 100 - p.confidence;
    wSum += w;
    wYes += w * pYes;
    const name = db().callers.find((x) => x.id === p.userId)?.name ?? shortId(p.userId);
    return { name, side: p.side, hitRate: Math.round(c.hitRate * 100), total: c.total, w };
  });
  callers.sort((a, b) => b.w - a.w);
  const consensus = wSum > 0 ? wYes / wSum : market.yes;
  const fairYes = wSum > 0 ? market.yes * 0.6 + consensus * 0.4 : market.yes;

  // Beginners get the outcome Previs thinks is more likely; sizing handles value.
  const side: Side = fairYes >= 50 ? "yes" : "no";
  const sideProb = side === "yes" ? fairYes : 100 - fairYes;
  const marketSideProb = side === "yes" ? market.yes : 100 - market.yes;
  const edge = sideProb - marketSideProb;
  const confidence = Math.round(sideProb);
  const label: Advice["label"] = confidence >= 65 ? "Fairly sure" : confidence >= 55 ? "Leaning" : "Close call";

  const reasons: string[] = [];
  reasons.push(`The market gives ${side === "yes" ? "Yes" : "No"} ${Math.round(marketSideProb)}%. I make it about ${confidence}%.`);
  const top = callers.filter((c) => c.total >= 10).slice(0, 2);
  if (top.length) {
    const agree = top.filter((c) => c.side === side);
    reasons.push(
      agree.length === top.length
        ? `The most reliable callers on this agree (${top.map((c) => `${c.name}, right ${c.hitRate}%`).join("; ")}).`
        : `Callers are split — I trust ${top[0].name} most here (right ${top[0].hitRate}% of the time).`,
    );
  }
  if (edge < 0) reasons.push("The price already reflects this, so there's little to gain — keep it tiny.");
  else if (edge < 2) reasons.push("It's close, so keep the amount small.");

  // 2) Size it. Start from the edge, then let memory pull it down.
  let pct = edge >= 6 ? 4 : edge >= 2 ? 2.5 : 1;
  const because: string[] = [];
  const limit = parseLimitPct(mine);
  if (limit && pct > limit) {
    pct = limit;
    because.push(`You told me your limit is ${limit}% per trade.`);
  } else if (limit) {
    because.push(`Kept under the ${limit}% limit you set.`);
  }
  const stats = userStats(userId);
  if (stats.lossStreak >= 2) {
    pct = Math.min(pct, 1);
    because.push(`You've lost your last ${stats.lossStreak} picks — I kept this small so you don't chase losses.`);
  }
  const fan = mine.find((m) => {
    const team = teamFrom(m.text);
    return team.length > 2 && market.title.toLowerCase().includes(team);
  });
  if (fan && side === "yes") because.push(`Heads up: you support ${teamFrom(fan.text, true)}, so double-check you're not betting with your heart.`);
  for (const m of mine) {
    const r = m.text.match(/(YES|NO) pick on "([^"]+)" \(([^)]+)\) (won|lost)/);
    if (r && r[3] === market.league && r[2] !== market.title) {
      because.push(`Last time on ${market.league}, your ${r[1]} pick on “${r[2]}” ${r[4]}.`);
      break;
    }
  }
  const trusted = cred.find((m) => callers.some((c) => m.text.includes(c.name)));
  if (trusted && !because.length) because.push(trusted.text);

  const amount = Math.max(5, Math.round((BALANCE * pct) / 100 / 5) * 5);

  return {
    marketId: market.id,
    marketTitle: market.title,
    side,
    confidence,
    label,
    reasons,
    because,
    amount,
    callers: callers.map((c) => ({ name: c.name, side: c.side, hitRate: c.hitRate, total: c.total })),
    memoriesUsed: [...mine, ...cred].slice(0, 6),
  };
}

/** Cheap, memory-free pick for market cards (no Walrus round-trips). */
export function quickPick(market: Market): { side: Side; confidence: number } {
  let wSum = 0;
  let wYes = 0;
  for (const p of db().picks) {
    if (p.marketId !== market.id || p.source !== "caller" || p.status !== "open") continue;
    const c = credibility(p.userId);
    const w = Math.max(0, c.score - 0.42) * Math.sqrt(c.total);
    wSum += w;
    wYes += w * (p.side === "yes" ? p.confidence : 100 - p.confidence);
  }
  const fairYes = wSum > 0 ? market.yes * 0.6 + (wYes / wSum) * 0.4 : market.yes;
  const side: Side = fairYes >= 50 ? "yes" : "no";
  return { side, confidence: Math.round(side === "yes" ? fairYes : 100 - fairYes) };
}

function teamFrom(text: string, pretty = false): string {
  const m = text.match(/(?:supports?|fan of|i back|backs)\s+([A-Z][\w.]*(?:\s[A-Z][\w.]*)?)/);
  const t = m ? m[1].trim().replace(/[.,!]+$/, "") : "";
  return pretty ? t : t.toLowerCase();
}

/** Things a user says that are worth remembering. Returns the memory text, if any. */
function extractFact(q: string): string | null {
  const s = q.trim();
  const limit = s.match(/(?:limit|max(?:imum)?|never (?:bet|risk|put)(?: more than)?)\D{0,20}(\d{1,2}(?:\.\d)?)\s*%/i);
  if (limit) return `User's risk limit: max ${limit[1]}% of balance per trade.`;
  const team = s.match(/\bi(?:'m| am)? (?:a )?(?:support|fan of|back)\s+([A-Za-z][\w.]*(?:\s[A-Z][\w.]*)?)/i);
  if (team) return `User supports ${team[1].charAt(0).toUpperCase()}${team[1].slice(1)}.`;
  const rem = s.match(/^remember(?: that)?\s+(.{6,200})$/i);
  if (rem) return `User says: ${rem[1]}`;
  return null;
}

const STOP = new Set(["the", "and", "for", "you", "your", "what", "whats", "will", "win", "pick", "should", "this", "that", "with", "about", "how", "much", "next", "their", "does", "mean", "big", "today", "best", "show", "game", "match", "market", "per", "trade", "limit", "max"]);

function findMarket(q: string): Market | undefined {
  const words = q.toLowerCase().split(/[^a-z0-9$]+/).filter((w) => w.length > 2 && !STOP.has(w));
  let best: Market | undefined;
  let bestScore = 0;
  for (const m of listMarkets()) {
    const hay = new Set(`${m.title} ${m.icon} ${m.league}`.toLowerCase().split(/[^a-z0-9$]+/));
    const s = words.filter((w) => hay.has(w)).length;
    if (s > bestScore) [best, bestScore] = [m, s];
  }
  return bestScore >= 1 ? best : undefined;
}

export async function ask(userId: string, question: string, marketId?: string): Promise<CopilotReply> {
  const q = question.trim();
  let learned: string | undefined;
  const fact = extractFact(q);
  if (fact) {
    await remember(userNs(userId), fact);
    learned = fact;
  }

  // A pure "here's a fact about me" message gets a confirmation, not a pick.
  const market = (marketId && getMarket(marketId)) || (learned ? undefined : findMarket(q));
  if (!market) {
    if (learned) {
      return { text: "Got it — I'll remember that and use it in every pick from now on.", learned, suggestions: ["Show me the best pick today", "What does 58% mean?"] };
    }
    const all = await Promise.all(listMarkets().filter((m) => !m.live).map((m) => advise(userId, m)));
    const best = all.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    const lines = best.map((a) => `• ${a.marketTitle} → ${a.side === "yes" ? "Yes" : "No"} (${a.label.toLowerCase()}, ${a.confidence}%)`);
    return {
      text: `Here's where I'm most sure right now:\n${lines.join("\n")}\nPick one and I'll tell you how much to put in.`,
      suggestions: best.map((a) => a.marketTitle),
    };
  }

  const advice = await advise(userId, market);
  const sideWord = advice.side === "yes" ? "Yes" : "No";
  let text: string;
  if (/mean|what is|explain|how does/i.test(q)) {
    text = `The market says ${market.yes}% for Yes. That means a Yes share costs ${market.yes}¢ and pays $1 if it happens. A No share costs ${100 - market.yes}¢. My pick is ${sideWord}.`;
  } else if (/lose|risk|safe/i.test(q)) {
    text = `You can only lose what you put in. If you put $${advice.amount} on ${sideWord} and it misses, you lose $${advice.amount}. This is paper money, so it's practice.`;
  } else if (/big|how much|size|amount|stake/i.test(q)) {
    text = `I'd put $${advice.amount} on ${sideWord} — that's ${(advice.amount / BALANCE * 100).toFixed(1)}% of your balance.`;
  } else {
    text = `My pick: ${sideWord}. ${advice.label} (${advice.confidence}%). I'd put in $${advice.amount}.`;
  }
  if (learned) text = `Noted — I'll remember that. ${text}`;

  text = await maybePolish(text, q, advice);
  return { text, advice, learned, suggestions: ["Should I go big?", "What does the % mean?", "What if I lose?"] };
}

// The AI layer phrases the answer naturally. The numbers always come from
// `advise`, never from the model — if a reply drops or changes a number, we
// fall back to the plain draft.
const SYSTEM =
  "You are Previs AI Copilot, a friendly trading buddy for beginners on a paper-trading prediction market. Rewrite the draft answer in 1-3 short plain sentences. Keep every number exactly as given. No jargon, no disclaimers, no markdown.";

interface AIBinding { run(model: string, input: unknown): Promise<unknown> }

async function workersAI(): Promise<AIBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return ((ctx.env as Record<string, unknown>).AI as AIBinding) ?? null;
  } catch {
    return null;
  }
}

function keepsNumbers(draft: string, out: string) {
  const nums = draft.match(/\d+(?:\.\d+)?/g) ?? [];
  return nums.every((n) => out.includes(n));
}

async function maybePolish(text: string, question: string, advice: Advice): Promise<string> {
  const user = `Question: ${question}\nDraft answer: ${text}\nFacts: ${JSON.stringify({ reasons: advice.reasons, because: advice.because })}`;
  let out: string | undefined;
  try {
    const ai = await workersAI();
    if (ai) {
      // Free on Cloudflare's Workers Free plan (10,000 neurons/day).
      const r = (await ai.run(process.env.WORKERS_AI_MODEL || "@cf/google/gemma-4-26b-a4b-it", {
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
        max_tokens: 200,
      })) as { response?: string; choices?: { message?: { content?: string } }[] };
      out = r.response ?? r.choices?.[0]?.message?.content;
    } else if (process.env.ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 200, system: SYSTEM, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json()) as { content?: { type: string; text: string }[] };
      out = json.content?.find((c) => c.type === "text")?.text;
    }
  } catch (e) {
    console.warn("[ai] phrasing failed, using draft", e);
  }
  out = out?.trim();
  return out && keepsNumbers(text, out) ? out : text;
}
