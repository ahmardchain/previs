"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { useUser } from "@/components/UserProvider";
import type { LeaderRow, MarketDTO } from "@/lib/types";
import { humanize } from "@/lib/humanize";

const TABS = ["All", "Live", "Sports", "Crypto"] as const;

export default function Home() {
  const { userId } = useUser();
  const [markets, setMarkets] = useState<MarketDTO[] | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [memory, setMemory] = useState<{ total: number; latest?: string } | null>(null);

  useEffect(() => {
    fetch("/api/markets").then((r) => r.json()).then(setMarkets).catch(() => setMarkets([]));
    fetch("/api/leaderboard").then((r) => r.json()).then(setLeaders).catch(() => {});
  }, []);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/memory?userId=${userId}`).then((r) => r.json())
      .then((d) => setMemory({ total: d.total, latest: d.memories?.[0]?.text })).catch(() => {});
  }, [userId]);

  const shown = useMemo(() => {
    let list = markets ?? [];
    if (tab === "Live") list = list.filter((m) => m.live);
    if (tab === "Sports" || tab === "Crypto") list = list.filter((m) => m.category === tab);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    return list;
  }, [markets, tab, query]);

  const copilot = leaders.find((l) => l.id === "caller:copilot");

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 40 }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <span className="eyebrow" style={{ letterSpacing: ".22em" }}>Paper-trade · sports &amp; crypto</span>
          <h1 className="display fade-up" style={{ margin: 0, fontSize: "clamp(42px, 7vw, 64px)", lineHeight: 1, fontWeight: 800 }}>
            Every call,<br /><span style={{ color: "var(--lime)" }}>on the record.</span>
          </h1>
          <p className="muted" style={{ margin: 0, maxWidth: 540, lineHeight: 1.6, fontSize: 16 }}>
            A copilot that remembers how you trade — and saves every pick before the game starts, so anyone can check who was right.
          </p>
        </div>
        <div style={{ flex: "1 1 300px", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
          <a href="#markets" className="btn btn-ghost" style={{ minHeight: 52, letterSpacing: ".14em" }}>START TRADING →</a>
          <Link href="/copilot" className="btn btn-lime" style={{ minHeight: 52, letterSpacing: ".14em" }}>ASK AI COPILOT</Link>
        </div>
      </section>

      <section aria-label="Copilot spotlight" className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>Copilot remembers</span>
          <span style={{ lineHeight: 1.5 }}>{memory?.latest ? humanize(memory.latest) : "Nothing yet. Make a pick or tell the copilot your limit — it'll remember."}</span>
        </div>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Copilot track record</span>
          <span className="display" style={{ fontSize: 28, fontWeight: 700 }}>
            {copilot ? `${copilot.hitRate}%` : "—"} <span style={{ fontFamily: "var(--body)", fontSize: 14, fontWeight: 500, color: "var(--muted)" }}>right over {copilot?.total ?? 0} saved calls</span>
          </span>
        </div>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Memories saved on Walrus</span>
          <span className="display" style={{ fontSize: 28, fontWeight: 700 }}>{memory?.total ?? 0}</span>
        </div>
      </section>

      <section id="markets" aria-label="Markets" style={{ display: "flex", flexDirection: "column", gap: 20, scrollMarginTop: 90 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>Markets</h2>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {TABS.map((t) => (
            <button key={t} className="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
          <label style={{ marginLeft: "auto", flex: "0 1 260px" }}>
            <span className="sr-only">Search markets</span>
            <input className="input" style={{ minHeight: 44, borderRadius: 999 }} placeholder="Search markets" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <div className="stagger" style={{ flex: "999 1 640px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {markets === null && <p className="muted">Loading markets…</p>}
            {markets && shown.length === 0 && <p className="muted">No markets match.</p>}
            {shown.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>

          <aside aria-label="Receipts leaderboard" className="card" style={{ flex: "1 1 300px", minWidth: 0, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="eyebrow">Receipts</span>
              <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>Who to trust</span>
              <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Ranked only on picks saved before the result. The copilot listens to the top of this list most.</span>
            </div>
            {leaders.slice(0, 8).map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ width: 24, fontSize: 13, color: "var(--faint)", fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{l.total} picks · <span style={{ color: "var(--yes)" }}>{l.hitRate}% right</span></span>
                </div>
                <span className="pill" style={{ border: "1px solid var(--line-strong)", color: "var(--muted)" }} title="Trust score the copilot uses">{l.score}</span>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <nav aria-label="Quick links" style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 15, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4, padding: 6, borderRadius: 999, background: "rgba(20,20,22,.92)", border: "1px solid #27272a", backdropFilter: "blur(12px)" }}>
          <a href="#markets" className="btn" style={{ background: "var(--line)", color: "var(--text)", letterSpacing: ".16em", fontSize: 13 }}>MARKETS</a>
          <Link href="/portfolio" className="btn" style={{ color: "var(--muted)", letterSpacing: ".16em", fontSize: 13, whiteSpace: "nowrap" }}>MY PICKS</Link>
        </div>
        <Link href="/copilot" aria-label="Open AI Copilot" className="btn btn-lime" style={{ width: 56, height: 56, padding: 0, fontSize: 22 }}>✦</Link>
      </nav>
    </main>
  );
}
